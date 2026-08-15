/**
 * Extração de movimentações a partir de extratos bancários em PDF — inicialmente com foco no
 * layout do Banco do Brasil, mas escrito de forma tolerante a variações de coluna/formatação.
 *
 * Todo o processamento acontece localmente no navegador (pdf.js), sem enviar o arquivo nem os
 * dados extraídos para nenhum servidor externo. Primeiro tentamos ler o texto já embutido no PDF
 * (nunca OCR nesta etapa); se o arquivo não tiver texto extraível (imagem digitalizada), avisamos
 * claramente em vez de tentar interpretar qualquer coisa.
 *
 * O resultado tem exatamente a mesma forma (`ParsedStatement`/`ParsedStatementRow`) usada pelos
 * demais formatos, para reaproveitar sem alterações o pipeline existente de deduplicação,
 * inferência de tipo, regras de classificação e detecção de transferência.
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
// Importa o worker como um asset — o Vite resolve a URL final respeitando o `base` configurado
// (inclusive em produção, no GitHub Pages, sob `/minha-vida-financeira/`), então o worker nunca
// aponta para um caminho quebrado após o deploy.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseCurrencyInput } from './format'
import { extractCounterparty } from './importCounterparty'
import type { ParsedStatement, ParsedStatementRow, PdfUnrecognizedCandidate } from './importParsers'

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

function stripAccents(s: string): string {
  const diacritics = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return s.normalize('NFD').replace(diacritics, '')
}

function normalize(s: string): string {
  return stripAccents(s || '').toLowerCase()
}

// ---------- extração de texto (pdf.js) ----------

interface RawTextItem {
  str: string
  transform: number[]
}

function isTextItem(item: unknown): item is RawTextItem {
  return typeof item === 'object' && item !== null && typeof (item as { str?: unknown }).str === 'string' && Array.isArray((item as { transform?: unknown }).transform)
}

/** Agrupa itens de texto de uma página em "linhas" visuais, usando a coordenada Y (com uma
 * pequena tolerância) — pdf.js não devolve quebras de linha prontas. Ordena de cima para baixo, e
 * dentro de cada linha da esquerda para a direita. */
function groupItemsIntoLines(items: RawTextItem[]): string[] {
  const TOL = 2.5
  const points = items
    .filter((it) => it.str.trim() !== '')
    .map((it) => ({ x: it.transform[4] ?? 0, y: it.transform[5] ?? 0, str: it.str }))

  const clusters: { y: number; parts: { x: number; str: string }[] }[] = []
  for (const p of points) {
    let cluster = clusters.find((c) => Math.abs(c.y - p.y) <= TOL)
    if (!cluster) {
      cluster = { y: p.y, parts: [] }
      clusters.push(cluster)
    }
    cluster.parts.push({ x: p.x, str: p.str })
  }

  clusters.sort((a, b) => b.y - a.y)
  return clusters
    .map((c) => {
      c.parts.sort((a, b) => a.x - b.x)
      return c.parts
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    })
    .filter((line) => line.length > 0)
}

/** Uma linha extraída do PDF junto da página (1-based) onde apareceu — usada só para preservar
 * contexto em possíveis movimentações não reconhecidas ("Precisa de revisão"); o parser do Banco do
 * Brasil continua tratando as linhas como texto simples, sem depender da página. */
interface PdfLine {
  text: string
  page: number
}

async function extractLinesFromPdf(file: File): Promise<PdfLine[]> {
  const buffer = await file.arrayBuffer()
  const loadingTask = getDocument({ data: buffer })
  const pdf = await loadingTask.promise
  const allLines: PdfLine[] = []
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const items = (content.items as unknown[]).filter(isTextItem)
      for (const text of groupItemsIntoLines(items)) {
        allLines.push({ text, page: pageNum })
      }
    }
  } finally {
    await loadingTask.destroy()
  }
  return allLines
}

// ---------- reconhecimento de cabeçalhos/rodapés (foco Banco do Brasil) ----------

const HEADER_FOOTER_PATTERNS: RegExp[] = [
  /banco do brasil/i,
  /autoatendimento\s*bb/i,
  /\bsisbb\b/i,
  /^ag[eê]ncia\b/i,
  /^conta\b\s*[:\-]?\s*(\d.*)?$/i,
  /^cliente\b/i,
  /^p[aá]gina\s*\d+/i,
  /^extrato\b/i,
  /data\s+de\s+emiss[aã]o/i,
  /^[-=_*]{3,}$/,
  /^cnpj\b/i,
  /^cpf\b\s*[:\-]/i,
  /ouvidoria/i,
  /central\s+de\s+(atendimento|relacionamento)/i,
  /\bsac\b\s*[:\-]?\s*0800/i,
  /^www\./i,
  /deficiente\s+auditivo/i,
  /^per[ií]odo\b/i,
  /^varia[cç][aã]o\b/i,
  /data\s+balancete/i,
  /dia\s+base/i,
]

function isHeaderFooterLine(line: string): boolean {
  return HEADER_FOOTER_PATTERNS.some((re) => re.test(line))
}

function isColumnHeaderLine(line: string): boolean {
  const norm = normalize(line)
  const keywords = ['data', 'historico', 'valor', 'saldo', 'documento', 'origem', 'lancamento', 'descricao']
  const hits = keywords.filter((k) => norm.includes(k)).length
  const hasValueToken = /\d{1,3}(\.\d{3})*,\d{2}/.test(line)
  return hits >= 2 && !hasValueToken
}

// ---------- datas ----------

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  fev: '02',
  mar: '03',
  abr: '04',
  mai: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  set: '09',
  out: '10',
  nov: '11',
  dez: '12',
}

/** Interpreta um token de data já isolado (dd/mm/aaaa, dd/mm ou "dd MON aaaa"). Nunca inventa um
 * ano: quando o token não traz o ano e não há um ano de referência do próprio extrato, devolve
 * `null` (fica pendente de revisão manual) em vez de arriscar uma data errada. */
function parsePdfDateToken(token: string, fallbackYear: string | null): string | null {
  const t = token.trim()

  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = `20${y}`
    return `${y}-${m[2]}-${m[1]}`
  }

  m = t.match(/^(\d{2})\/(\d{2})$/)
  if (m) {
    if (!fallbackYear) return null
    return `${fallbackYear}-${m[2]}-${m[1]}`
  }

  m = t.match(/^(\d{2})\s+([A-Za-zçÇ]{3})\.?\s*(\d{4})?$/)
  if (m) {
    const mon = MONTH_MAP[normalize(m[2]).slice(0, 3)]
    if (!mon) return null
    const y = m[3] || fallbackYear
    if (!y) return null
    return `${y}-${mon}-${m[1]}`
  }

  return null
}

const LEADING_DATE_RE = /^(\d{2}\/\d{2}(?:\/\d{2,4})?|\d{2}\s+[A-Za-zçÇ]{3}\.?\s*(?:\d{4})?)\s+(.+)$/

/** Tenta achar, nas primeiras linhas do extrato, um ano de referência (ex.: "Data de emissão:
 * 05/01/2026" ou "Período: 01/01/2026 a 31/01/2026") — usado apenas quando uma data do meio do
 * extrato vem sem ano (ex.: "05/01"). */
function findFallbackYear(lines: string[]): string | null {
  for (const l of lines.slice(0, 40)) {
    const m = l.match(/\d{2}\/\d{2}\/(\d{4})/)
    if (m) return m[1]
  }
  return null
}

// ---------- valor e direção ----------

const VALUE_TOKEN_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g

function inferPdfDirection(label: string): 'entrada' | 'saida' | null {
  const t = normalize(label)
  if (t.includes('pix') && t.includes('receb')) return 'entrada'
  if (t.includes('pix') && (t.includes('envi') || t.includes('pag'))) return 'saida'
  if (t.includes('pagamento')) return 'saida'
  if (t.includes('tarifa')) return 'saida'
  if (t.includes('debito')) return 'saida'
  if (t.includes('credito')) return 'entrada'
  if (t.includes('deposito')) return 'entrada'
  if (t.includes('juros')) return 'entrada'
  if (t.includes('saque')) return 'saida'
  if (t.includes('transfer') && t.includes('receb')) return 'entrada'
  if (t.includes('transfer') && t.includes('envi')) return 'saida'
  return null
}

/** Procura, logo depois do token de valor escolhido, um marcador explícito de crédito/débito
 * (C, D, CR, DB) ou sinal — só usa inferência por palavra-chave quando não há marcador nenhum. */
function resolveDirectionMarker(rest: string, valueToken: string): 'entrada' | 'saida' | null {
  if (valueToken.trim().startsWith('-')) return 'saida'
  const idx = rest.indexOf(valueToken)
  if (idx >= 0) {
    const after = rest.slice(idx + valueToken.length, idx + valueToken.length + 6)
    const m = after.match(/^\s*(CR|DB|C|D)\b/i)
    if (m) {
      const marker = m[1].toUpperCase()
      if (marker === 'C' || marker === 'CR') return 'entrada'
      if (marker === 'D' || marker === 'DB') return 'saida'
    }
  }
  return null
}

// ---------- rótulo de tipo (para os cards de "possível movimentação") ----------

function detectTypeLabel(text: string): string | undefined {
  const t = normalize(text)
  if (t.includes('pix') && t.includes('receb')) return 'Pix - Recebido'
  if (t.includes('pix') && t.includes('envi')) return 'Pix - Enviado'
  if (t.includes('pagamento')) return 'Pagamento'
  if (t.includes('tarifa')) return 'Tarifa'
  if (t.includes('debito')) return 'Débito'
  if (t.includes('credito')) return 'Crédito'
  if (t.includes('deposito')) return 'Depósito'
  if (t.includes('juros')) return 'Juros'
  if (t.includes('saque')) return 'Saque'
  if (t.includes('transfer')) return 'Transferência'
  if (t.includes('boleto')) return 'Boleto'
  return undefined
}

/** Tenta achar um número de documento provável no texto (ex.: "69.168.651"), evitando reaproveitar
 * o mesmo trecho já usado como data ou valor. Nunca inventa — devolve `undefined` se não achar. */
function extractProbableDocument(text: string, exclude: string[]): string | undefined {
  const candidates = [
    ...[...text.matchAll(/\b\d{2,3}(?:\.\d{3}){1,3}\b/g)].map((m) => m[0]),
    ...[...text.matchAll(/\b\d{5,}\b/g)].map((m) => m[0]),
  ]
  for (const c of candidates) {
    if (exclude.includes(c)) continue
    return c
  }
  return undefined
}

function extractCounterpartyGuess(clusterLines: string[]): string | undefined {
  for (const line of clusterLines) {
    const guess = extractCounterparty(line)
    if (guess) return guess
  }
  return undefined
}

/** Monta um card de "possível movimentação" com o máximo de contexto que pudermos identificar com
 * segurança a partir de um grupo de linhas órfãs adjacentes — nunca inventa data, valor ou
 * contraparte: quando não dá para determinar algo com segurança, o campo fica `undefined`/`null`. */
function buildCandidateFromCluster(clusterLines: string[], fallbackYear: string | null, page?: number): PdfUnrecognizedCandidate {
  const combined = clusterLines.join(' / ')

  const dateMatch = combined.match(/\d{2}\/\d{2}(?:\/\d{2,4})?/)
  const probableDate = dateMatch ? parsePdfDateToken(dateMatch[0], fallbackYear) : null

  const valueTokens = [...combined.matchAll(VALUE_TOKEN_RE)].map((m) => m[0])
  let probableAmount: number | null = null
  if (valueTokens.length > 0) {
    const v = parseCurrencyInput(valueTokens[valueTokens.length - 1])
    probableAmount = Number.isNaN(v) ? null : Math.abs(v)
  }

  const marker = valueTokens.length > 0 ? resolveDirectionMarker(combined, valueTokens[valueTokens.length - 1]) : null
  const probableDirection = marker ?? inferPdfDirection(combined)

  const typeLabel = detectTypeLabel(combined)
  const probableCounterparty = extractCounterpartyGuess(clusterLines)
  const probableDocument = extractProbableDocument(combined, [...(dateMatch ? [dateMatch[0]] : []), ...valueTokens])

  return {
    contextLines: clusterLines,
    typeLabel,
    probableDate,
    probableAmount,
    probableDirection,
    probableCounterparty,
    probableDocument,
    page,
  }
}

// ---------- máquina de estados principal ----------

interface PendingTransaction {
  date: string | null
  typeLabel: string
  amount: number
  direction: 'entrada' | 'saida' | null
  balance?: number
  continuationParts: string[]
  rawLine: string
}

interface OrphanEntry {
  text: string
  seq: number
  page: number
}

interface PdfParseResult {
  rows: ParsedStatementRow[]
  unrecognizedCandidates: PdfUnrecognizedCandidate[]
  previousBalance?: { amount: number; asOfDate: string | null }
}

function parsePdfLines(lines: PdfLine[]): PdfParseResult {
  const rows: ParsedStatementRow[] = []
  const orphanEntries: OrphanEntry[] = []
  let previousBalance: { amount: number; asOfDate: string | null } | undefined
  const fallbackYear = findFallbackYear(lines.map((l) => l.text))

  let pending: PendingTransaction | null = null
  let seq = 0

  const flushPending = () => {
    if (!pending) return
    const continuationJoined = pending.continuationParts.join(' / ').trim()
    const description = continuationJoined ? `${pending.typeLabel} | ${continuationJoined}` : pending.typeLabel
    const counterparty = pending.continuationParts.length > 0 ? pending.continuationParts.join(' ').trim() : undefined

    rows.push({
      index: rows.length,
      date: pending.date,
      description,
      friendlyDescription: pending.typeLabel || 'Movimentação',
      counterparty,
      amount: pending.amount,
      direction: pending.direction,
      balance: pending.balance,
      rawFields: { linha: pending.rawLine, complemento: continuationJoined },
    })
    pending = null
  }

  for (const { text: rawLineText, page } of lines) {
    const line = rawLineText.trim()
    seq++
    if (!line) continue

    if (isHeaderFooterLine(line) || isColumnHeaderLine(line)) {
      continue
    }

    if (/saldo\s+anterior/i.test(line)) {
      flushPending()
      const valueMatch = line.match(VALUE_TOKEN_RE)
      const dateMatch = line.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)/)
      if (valueMatch && !previousBalance) {
        const amount = parseCurrencyInput(valueMatch[valueMatch.length - 1])
        const asOfDate = dateMatch ? parsePdfDateToken(dateMatch[1], fallbackYear) : null
        if (!Number.isNaN(amount)) previousBalance = { amount, asOfDate }
      }
      continue
    }

    const leadingDateMatch = line.match(LEADING_DATE_RE)
    if (leadingDateMatch) {
      const rest = leadingDateMatch[2]
      const tokenMatches = [...rest.matchAll(VALUE_TOKEN_RE)]
      if (tokenMatches.length > 0) {
        flushPending()

        const dateStr = parsePdfDateToken(leadingDateMatch[1], fallbackYear)
        const balanceTokenMatch = tokenMatches.length >= 2 ? tokenMatches[tokenMatches.length - 1] : null
        const valueTokenMatch = tokenMatches.length >= 2 ? tokenMatches[tokenMatches.length - 2] : tokenMatches[tokenMatches.length - 1]

        const valueToken = valueTokenMatch[0]
        const typeLabel = rest.slice(0, valueTokenMatch.index).trim().replace(/\s{2,}/g, ' ')

        const marker = resolveDirectionMarker(rest, valueToken)
        const direction = marker ?? inferPdfDirection(typeLabel)

        const amount = Math.abs(parseCurrencyInput(valueToken))
        const balance = balanceTokenMatch ? parseCurrencyInput(balanceTokenMatch[0]) : undefined

        pending = {
          date: dateStr,
          typeLabel: typeLabel || 'Movimentação',
          amount: Number.isNaN(amount) ? 0 : amount,
          direction,
          balance: balance !== undefined && !Number.isNaN(balance) ? balance : undefined,
          continuationParts: [],
          rawLine: line,
        }
        continue
      }
    }

    if (pending) {
      pending.continuationParts.push(line)
    } else {
      orphanEntries.push({ text: line, seq, page })
    }
  }
  flushPending()

  // Nunca mostra de novo, como "não reconhecida", uma linha que já faz parte de uma movimentação
  // reconhecida (ex.: um recapitulativo solto de "Pix - Recebido" que apareceu em outro ponto do
  // extrato) — evita falsos positivos que não ajudam a usuária a entender o que realmente falta revisar.
  const consumedTexts = rows.flatMap((r) => [normalize(r.friendlyDescription), normalize(r.counterparty || ''), normalize(r.description)]).filter((t) => t.length >= 4)

  // Agrupa linhas órfãs fisicamente adjacentes (sem nenhuma outra linha, cabeçalho ou movimentação,
  // entre elas) num único card de contexto — em vez de mostrar cada fragmento solto isoladamente.
  const clusters: { lines: string[]; page: number }[] = []
  let previousSeq: number | null = null
  for (const entry of orphanEntries) {
    const last = clusters[clusters.length - 1]
    if (last && previousSeq !== null && entry.seq - previousSeq === 1) {
      last.lines.push(entry.text)
    } else {
      clusters.push({ lines: [entry.text], page: entry.page })
    }
    previousSeq = entry.seq
  }

  const unrecognizedCandidates: PdfUnrecognizedCandidate[] = []
  for (const cluster of clusters) {
    const combinedNormalized = normalize(cluster.lines.join(' ')).trim()
    const isDuplicateOfRecognized = combinedNormalized.length >= 6 && consumedTexts.some((ct) => ct.includes(combinedNormalized))
    if (isDuplicateOfRecognized) continue
    unrecognizedCandidates.push(buildCandidateFromCluster(cluster.lines, fallbackYear, cluster.page))
  }

  return { rows, unrecognizedCandidates, previousBalance }
}

// ---------- detecção do banco pelo conteúdo (nunca pelo nome do arquivo) ----------

/** Cada banco tem marcadores textuais bem distintos que não aparecem nos outros formatos suportados
 * (Banco do Brasil, Nubank, Neon). Quando nenhum marcador específico é encontrado, cai no parser
 * padrão (Banco do Brasil e formatos semelhantes), preservando o comportamento já existente. */
function detectPdfBank(lines: PdfLine[]): 'nubank' | 'neon' | 'bb' {
  const hasAny = (patterns: RegExp[]) => lines.some(({ text }) => patterns.some((re) => re.test(text)))

  if (hasAny([/Neon Pagamentos S\/A/i, /^Conta digital\b/i, /Descri[cç][ãa]o Data Hora Valor Saldo Cart[ãa]o/i])) {
    return 'neon'
  }
  if (
    hasAny([
      /\bNU PAGAMENTOS\b/i,
      /Nu Financeira/i,
      /^Movimenta[cç][oõ]es\s*$/i,
      /Total de entradas/i,
      /Total de sa[ií]das/i,
      /Extrato gerado dia/i,
    ])
  ) {
    return 'nubank'
  }
  return 'bb'
}

// ---------- Nubank (extrato por blocos diários, não tabular) ----------

const NUBANK_DATE_TOTAL_RE = /^(\d{2})\s+([A-ZÇ]{3})\s+(\d{4})\s+Total de (entradas|sa[ií]das)\s*[+-]?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i
const NUBANK_DATE_ONLY_RE = /^(\d{2})\s+([A-ZÇ]{3})\s+(\d{4})\s*$/i
const NUBANK_TOTAL_ONLY_RE = /^Total de (entradas|sa[ií]das)\s*[+-]?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i
const NUBANK_SALDO_DIA_RE = /^Saldo do dia\b/i
const NUBANK_TRAILING_VALUE_RE = /(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/
const NUBANK_KNOWN_PREFIX_RE = /^(Transferência recebida|Transferência Recebida|Transferência enviada|Transferência Enviada|Dep[oó]sito recebido)\b/i

/** Cabeçalho/rodapé que se repete em toda página do extrato Nubank — nunca vira lançamento nem
 * "Precisa de revisão", mesmo quando termina em algo parecido com um valor (ex.: "Saldo inicial
 * 0,00"). Os identificadores de cliente/CNPJ/conta nunca são hardcoded por nome — só pelo formato. */
const NUBANK_NOISE_RES: RegExp[] = [
  /^CNPJ\b/i,
  /VALORES EM R\$\s*$/i,
  /^Saldo inicial\b/i,
  /^Rendimento líquido\b/i,
  /^Saldo final do per[ií]odo\b/i,
  /^R\$\s*[\d.,]+\s*$/,
  /^Tem alguma d[uú]vida/i,
  /^metropolitanas\)/i,
  /^Caso a solu[cç][ãa]o fornecida/i,
  /dispon[ií]veis em nubank\.com\.br/i,
  /^Extrato gerado dia/i,
  /^O saldo l[ií]quido corresponde/i,
  /^N[ãa]o nos responsabilizamos/i,
  /^Asseguramos a autenticidade/i,
  /^Nu Financeira S\.A\./i,
  /^Nu Pagamentos S\.A\./i,
  /^e Investimento\s*$/i,
  // cabeçalho "<identificador> <NOME EM MAIÚSCULAS>" repetido em toda página — nunca pelo nome real
  /^\d{2}\.\d{3}\.\d{3}\s+[A-ZÀ-Ü]/,
  // número de conta solto (ex.: "636167344-0") que sobra da quebra do cabeçalho entre páginas
  /^\d{6,}-\d$/,
]

/** Extrai a contraparte de uma movimentação Nubank a partir do texto completo (já com as linhas de
 * continuação juntadas) — sempre o nome que segue um dos prefixos conhecidos, cortando antes do
 * CPF/CNPJ mascarado e do banco de origem/destino (nunca usa data, hora, valor ou esses dados como
 * contraparte). */
function extractNubankCounterparty(fullText: string): string | undefined {
  const prefixes = [
    /^Transferência recebida pelo Pix\s+/i,
    /^Transferência Recebida\s+/i,
    /^Transferência enviada pelo Pix\s+/i,
    /^Transferência Enviada\s+/i,
    /^Dep[oó]sito recebido\s+/i,
  ]
  for (const prefix of prefixes) {
    if (prefix.test(fullText)) {
      const rest = fullText.replace(prefix, '')
      const dashIdx = rest.indexOf(' - ')
      const name = (dashIdx >= 0 ? rest.slice(0, dashIdx) : rest).trim()
      return name || undefined
    }
  }
  return undefined
}

function nubankTypeLabel(fullText: string): string {
  if (/^Transferência recebida pelo Pix/i.test(fullText) || /^Transferência Recebida/i.test(fullText)) return 'Transferência recebida'
  if (/^Transferência enviada pelo Pix/i.test(fullText) || /^Transferência Enviada/i.test(fullText)) return 'Transferência enviada'
  if (/^Dep[oó]sito recebido/i.test(fullText)) return 'Depósito recebido'
  return fullText.slice(0, 60).trim() || 'Movimentação'
}

interface NubankPending {
  date: string | null
  direction: 'entrada' | 'saida' | null
  amount: number | null
  descParts: string[]
  page: number
}

/**
 * Extrato Nubank: estrutura por blocos diários (ex.: "14 MAR 2026 Total de entradas + 2.225,00"),
 * nunca uma tabela. O valor de "Total de entradas"/"Total de saídas" é só um RESUMO do dia/bloco —
 * nunca vira Transaction sozinho. Cada movimentação individual pode ocupar várias linhas
 * (descrição multilinha), mas seu valor sempre aparece ao final da PRIMEIRA linha da movimentação —
 * as linhas seguintes (sem valor) são continuação da mesma movimentação, até a próxima linha com
 * valor, "Saldo do dia", um novo "Total de..." ou uma nova data encerrar o bloco.
 */
function parseNubankLines(lines: PdfLine[]): PdfParseResult {
  const rows: ParsedStatementRow[] = []
  const unrecognizedCandidates: PdfUnrecognizedCandidate[] = []

  let inMovimentacoes = false
  let currentDate: string | null = null
  let currentDirection: 'entrada' | 'saida' | null = null
  let pending: NubankPending | null = null

  const flushPending = () => {
    if (!pending) return
    if (pending.amount != null) {
      const fullText = pending.descParts.join(' ').replace(/\s+/g, ' ').trim()
      rows.push({
        index: rows.length,
        date: pending.date,
        description: fullText,
        friendlyDescription: nubankTypeLabel(fullText),
        counterparty: extractNubankCounterparty(fullText),
        amount: pending.amount,
        direction: pending.direction,
        rawFields: { linha: pending.descParts[0] ?? '' },
      })
    } else {
      // Prefixo de movimentação reconhecido, mas sem valor localizável com segurança nesta linha —
      // nunca inventa o valor: manda para revisão manual, preservando página, data e direção já
      // conhecidas (ver "Linhas não reconhecidas" nos requisitos).
      unrecognizedCandidates.push({
        contextLines: pending.descParts,
        typeLabel: nubankTypeLabel(pending.descParts.join(' ')),
        probableDate: pending.date,
        probableAmount: null,
        probableDirection: pending.direction,
        page: pending.page,
        reason: 'Não foi possível identificar o valor desta movimentação.',
      })
    }
    pending = null
  }

  for (const { text: rawLineText, page } of lines) {
    const line = rawLineText.trim()
    if (!line) continue

    if (!inMovimentacoes) {
      if (/^Movimenta[cç][oõ]es\s*$/i.test(line)) inMovimentacoes = true
      continue
    }
    if (NUBANK_NOISE_RES.some((re) => re.test(line))) continue

    let m = line.match(NUBANK_DATE_TOTAL_RE)
    if (m) {
      flushPending()
      const [, dd, mon, yyyy, dir] = m
      const monthNum = MONTH_MAP[normalize(mon).slice(0, 3)]
      currentDate = monthNum ? `${yyyy}-${monthNum}-${dd}` : null
      currentDirection = /entrada/i.test(dir) ? 'entrada' : 'saida'
      continue
    }
    m = line.match(NUBANK_DATE_ONLY_RE)
    if (m) {
      // Data sozinha, sem o "Total de..." na mesma linha — acontece quando a quebra de página corta
      // o bloco logo depois da data; o total/direção reais vêm a seguir (com ou sem repetir a data).
      flushPending()
      const [, dd, mon, yyyy] = m
      const monthNum = MONTH_MAP[normalize(mon).slice(0, 3)]
      currentDate = monthNum ? `${yyyy}-${monthNum}-${dd}` : null
      continue
    }
    m = line.match(NUBANK_TOTAL_ONLY_RE)
    if (m) {
      // "Total de entradas/saídas" sem data na mesma linha — continua valendo a última data vista
      // (mesmo bloco/dia, ou continuação após quebra de página).
      flushPending()
      currentDirection = /entrada/i.test(m[1]) ? 'entrada' : 'saida'
      continue
    }
    if (NUBANK_SALDO_DIA_RE.test(line)) {
      flushPending()
      continue
    }

    const valueMatch = line.match(NUBANK_TRAILING_VALUE_RE)
    if (valueMatch) {
      flushPending()
      const amount = Math.abs(parseCurrencyInput(valueMatch[1]))
      const descPart = line.slice(0, valueMatch.index).trim()
      pending = {
        date: currentDate,
        direction: currentDirection,
        amount: Number.isNaN(amount) ? null : amount,
        descParts: [descPart],
        page,
      }
      continue
    }

    if (pending) {
      pending.descParts.push(line)
    } else if (NUBANK_KNOWN_PREFIX_RE.test(line)) {
      pending = { date: currentDate, direction: currentDirection, amount: null, descParts: [line], page }
    } else {
      // Linha fora de qualquer bloco reconhecido — nunca descartada silenciosamente.
      unrecognizedCandidates.push({
        contextLines: [line],
        probableDate: currentDate,
        probableAmount: null,
        probableDirection: currentDirection,
        page,
        reason: 'Linha fora de um bloco de movimentação reconhecido.',
      })
    }
  }
  flushPending()

  return { rows, unrecognizedCandidates }
}

// ---------- Neon (extrato tabular) ----------

const NEON_NOISE_RES: RegExp[] = [
  /^Conta digital\b/i,
  /^Neon Pagamentos S\/A\b/i,
  /^Extrato por\s*$/i,
  /^Ano Base:/i,
  /^Per[ií]odo de \d/i,
  /^Chat do App/i,
  /^\d{1,2} horas por dia/i,
  /^\/timeneon/i,
  /^Fale com a gente/i,
  /^WhatsApp Ouvidoria/i,
]

const NEON_ROW_RE = /^(.*?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})\s+(-?)\s*R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)(?:\s*-)?\s*$/

/** Normaliza os caracteres corrompidos que o pdf.js extrai deste extrato Neon: o glifo de dois-pontos
 * da hora e o sinal de menos antes do valor da movimentação viram, os dois, o caractere nulo
 * (U+0000) — nunca aparecem como texto legível ("19￾06" em vez de "19:06", "￾R$ 38,90" em vez de
 * "-R$ 38,90"). Reconstrói ":" entre os dois grupos da hora, e "-" só quando o nulo antecede
 * diretamente "R$" do VALOR da movimentação — o saldo nunca tem esse sinal. */
// Construído via String.fromCharCode (nunca um escape de unicode cru no código-fonte) para o caractere
// nulo nunca acabar virando um byte de controle bruto dentro do arquivo .ts.
const NUL_CHAR = String.fromCharCode(0)
const NEON_NUL_BEFORE_RS_RE = new RegExp(NUL_CHAR + String.raw`(?=\s*R\$)`, 'g')
const NEON_NUL_BETWEEN_DIGITS_RE = new RegExp(String.raw`(\d{2})` + NUL_CHAR + String.raw`(\d{2})`, 'g')
const NEON_STRAY_NUL_RE = new RegExp(NUL_CHAR, 'g')

function normalizeNeonLine(rawLine: string): string {
  return rawLine
    .replace(NEON_NUL_BEFORE_RS_RE, '-')
    .replace(NEON_NUL_BETWEEN_DIGITS_RE, '$1:$2')
    .replace(NEON_STRAY_NUL_RE, '')
}

/** Contraparte Neon: para Pix, o nome já vem isolado depois de "de "/"para "/"crédito "/"débito "
 * (nunca usa data, hora, valor ou saldo como contraparte); para estornos, o estabelecimento
 * estornado; para compras/tarifas/faturas sem esses prefixos, a própria descrição já serve como
 * contraparte normalizada (ex.: "UBER PENDING SAO PAULO BR"). */
function extractNeonCounterparty(description: string): string | undefined {
  const prefixes: RegExp[] = [
    /^PIX recebido de\s+/i,
    /^PIX enviado para\s+/i,
    /^Pix cr[eé]dito\s+/i,
    /^Pix d[eé]bito\s+/i,
    /^Estorno de\s+/i,
  ]
  for (const prefix of prefixes) {
    if (prefix.test(description)) {
      const name = description.replace(prefix, '').trim()
      return name || undefined
    }
  }
  return description.trim() || undefined
}

/** Descrição curta Neon: para Pix/estorno, só o tipo (ex.: "PIX recebido"), separado da contraparte
 * — nunca repete o nome já extraído por `extractNeonCounterparty`. Para compras/tarifas/faturas sem
 * um prefixo reconhecido, o próprio texto já é curto o bastante (ex.: "UBER PENDING SAO PAULO BR"). */
function neonFriendlyLabel(description: string): string {
  if (/^PIX recebido de\s+/i.test(description)) return 'PIX recebido'
  if (/^PIX enviado para\s+/i.test(description)) return 'PIX enviado'
  if (/^Pix cr[eé]dito\s+/i.test(description)) return 'Pix crédito'
  if (/^Pix d[eé]bito\s+/i.test(description)) return 'Pix débito'
  if (/^Estorno de\s+/i.test(description)) return 'Estorno'
  return description
}

/** Extrato Neon: uma linha por movimentação ("Descrição Data Hora Valor Saldo Cartão"), nunca
 * multilinha. Nunca confunde o valor da movimentação com o saldo (sempre a primeira ocorrência de
 * "R$" depois da hora, nunca a segunda). */
function parseNeonLines(lines: PdfLine[]): PdfParseResult {
  const rows: ParsedStatementRow[] = []
  const unrecognizedCandidates: PdfUnrecognizedCandidate[] = []

  let sawColumnHeader = false
  let skipNextLine = false

  for (const { text: rawLineText, page } of lines) {
    const trimmed = rawLineText.trim()
    if (!trimmed) continue
    const line = normalizeNeonLine(trimmed)

    // Logo depois do rótulo "período Cliente Agência bancária Conta" vem uma linha só com os dados
    // da cliente (nome/agência/conta) — nunca uma movimentação; pulada pela posição, nunca pelo nome.
    if (/^per[ií]odo Cliente/i.test(line)) {
      skipNextLine = true
      continue
    }
    if (skipNextLine) {
      skipNextLine = false
      continue
    }
    if (/^Descri[cç][ãa]o Data Hora Valor Saldo Cart[ãa]o/i.test(line)) {
      sawColumnHeader = true
      continue
    }
    if (!sawColumnHeader) continue
    if (NEON_NOISE_RES.some((re) => re.test(line))) continue
    // Linha solta de continuação do nome da cliente (sobrenome que quebrou linha): só maiúsculas,
    // sem dígito nenhum, poucas palavras — nunca uma movimentação real.
    if (/^[A-ZÀ-Ü\s]+$/.test(line) && !/\d/.test(line) && line.split(' ').length <= 4) continue

    const m = line.match(NEON_ROW_RE)
    if (!m) {
      unrecognizedCandidates.push({
        contextLines: [trimmed],
        probableDate: null,
        probableAmount: null,
        probableDirection: null,
        page,
        reason: 'Linha não corresponde ao formato de movimentação Neon esperado.',
      })
      continue
    }

    const [, descRaw, dateBr, , , sign, valStr] = m
    const [dd, mo, yyyy] = dateBr.split('/')
    const description = descRaw.trim()
    const amount = Math.abs(parseCurrencyInput(valStr))

    rows.push({
      index: rows.length,
      date: `${yyyy}-${mo}-${dd}`,
      description,
      friendlyDescription: neonFriendlyLabel(description),
      counterparty: extractNeonCounterparty(description),
      amount: Number.isNaN(amount) ? null : amount,
      direction: sign === '-' ? 'saida' : 'entrada',
      rawFields: { linha: trimmed },
    })
  }

  return { rows, unrecognizedCandidates }
}

/** Ponto de entrada: lê um arquivo PDF de extrato e devolve um `ParsedStatement` no mesmo formato
 * usado pelos demais parsers. Nunca lança para o chamador — erros são devolvidos no campo
 * `error`, para a tela de importação mostrar uma mensagem clara em vez de quebrar. Detecta o banco
 * pelo CONTEÚDO extraído (nunca pelo nome do arquivo) e escolhe o parser adequado — Banco do Brasil
 * continua sendo o padrão quando nenhum marcador específico de Nubank/Neon é encontrado. */
export async function parsePdf(file: File): Promise<ParsedStatement> {
  let lines: PdfLine[]
  try {
    lines = await extractLinesFromPdf(file)
  } catch (err) {
    console.error('[import] falha ao ler PDF', err)
    return {
      kind: 'pdf',
      autoIdentified: false,
      rows: [],
      error: 'Não foi possível ler este PDF automaticamente. Tente outro arquivo ou revise o formato.',
    }
  }

  if (lines.length === 0) {
    return {
      kind: 'pdf',
      autoIdentified: false,
      rows: [],
      error: 'Este PDF parece ser uma imagem digitalizada e não contém texto extraível.',
    }
  }

  const bank = detectPdfBank(lines)
  const { rows, unrecognizedCandidates, previousBalance } =
    bank === 'nubank' ? parseNubankLines(lines) : bank === 'neon' ? parseNeonLines(lines) : parsePdfLines(lines)

  if (rows.length === 0 && unrecognizedCandidates.length === 0) {
    return {
      kind: 'pdf',
      autoIdentified: false,
      rows: [],
      error: 'Não foi possível ler este PDF automaticamente. Tente outro arquivo ou revise o formato.',
    }
  }

  return {
    kind: 'pdf',
    autoIdentified: true,
    rows,
    unrecognizedCandidates: unrecognizedCandidates.length > 0 ? unrecognizedCandidates : undefined,
    pdfPreviousBalance: previousBalance,
  }
}
