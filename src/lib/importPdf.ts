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

async function extractLinesFromPdf(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const loadingTask = getDocument({ data: buffer })
  const pdf = await loadingTask.promise
  const allLines: string[] = []
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const items = (content.items as unknown[]).filter(isTextItem)
      allLines.push(...groupItemsIntoLines(items))
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
function buildCandidateFromCluster(clusterLines: string[], fallbackYear: string | null): PdfUnrecognizedCandidate {
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
}

interface PdfParseResult {
  rows: ParsedStatementRow[]
  unrecognizedCandidates: PdfUnrecognizedCandidate[]
  previousBalance?: { amount: number; asOfDate: string | null }
}

function parsePdfLines(lines: string[]): PdfParseResult {
  const rows: ParsedStatementRow[] = []
  const orphanEntries: OrphanEntry[] = []
  let previousBalance: { amount: number; asOfDate: string | null } | undefined
  const fallbackYear = findFallbackYear(lines)

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

  for (const rawLine of lines) {
    const line = rawLine.trim()
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
      orphanEntries.push({ text: line, seq })
    }
  }
  flushPending()

  // Nunca mostra de novo, como "não reconhecida", uma linha que já faz parte de uma movimentação
  // reconhecida (ex.: um recapitulativo solto de "Pix - Recebido" que apareceu em outro ponto do
  // extrato) — evita falsos positivos que não ajudam a usuária a entender o que realmente falta revisar.
  const consumedTexts = rows.flatMap((r) => [normalize(r.friendlyDescription), normalize(r.counterparty || ''), normalize(r.description)]).filter((t) => t.length >= 4)

  // Agrupa linhas órfãs fisicamente adjacentes (sem nenhuma outra linha, cabeçalho ou movimentação,
  // entre elas) num único card de contexto — em vez de mostrar cada fragmento solto isoladamente.
  const clusters: string[][] = []
  let previousSeq: number | null = null
  for (const entry of orphanEntries) {
    const last = clusters[clusters.length - 1]
    if (last && previousSeq !== null && entry.seq - previousSeq === 1) {
      last.push(entry.text)
    } else {
      clusters.push([entry.text])
    }
    previousSeq = entry.seq
  }

  const unrecognizedCandidates: PdfUnrecognizedCandidate[] = []
  for (const cluster of clusters) {
    const combinedNormalized = normalize(cluster.join(' ')).trim()
    const isDuplicateOfRecognized = combinedNormalized.length >= 6 && consumedTexts.some((ct) => ct.includes(combinedNormalized))
    if (isDuplicateOfRecognized) continue
    unrecognizedCandidates.push(buildCandidateFromCluster(cluster, fallbackYear))
  }

  return { rows, unrecognizedCandidates, previousBalance }
}

/** Ponto de entrada: lê um arquivo PDF de extrato e devolve um `ParsedStatement` no mesmo formato
 * usado pelos demais parsers. Nunca lança para o chamador — erros são devolvidos no campo
 * `error`, para a tela de importação mostrar uma mensagem clara em vez de quebrar. */
export async function parsePdf(file: File): Promise<ParsedStatement> {
  let lines: string[]
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

  const { rows, unrecognizedCandidates, previousBalance } = parsePdfLines(lines)

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
