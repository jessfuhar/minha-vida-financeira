/**
 * Parsers tolerantes para os formatos de extrato aceitos: OFX, OFC, CSV, XLS,
 * XLSX e TXT (PDF fica fora desta etapa). Cada parser tenta reconhecer
 * automaticamente data, descrição, valor, entrada/saída, documento e saldo
 * (quando presentes) sem assumir nomes/ordens fixos de coluna — quando não
 * consegue com confiança, devolve os cabeçalhos e linhas cruas para a tela
 * de mapeamento manual decidir.
 */
import * as XLSX from 'xlsx'
import { parseCurrencyInput } from './format'
import { guessMapping, isMappingConfident, type MappableField } from './importMapping'
import { deriveImportedDescription } from './importCounterparty'

export type ImportFileKind = 'ofx' | 'ofc' | 'csv' | 'xls' | 'xlsx' | 'txt' | 'pdf'

export interface ParsedStatementRow {
  index: number
  /** ISO yyyy-mm-dd quando reconhecida; null se não foi possível interpretar. */
  date: string | null
  /** Texto exatamente como veio do arquivo — vira a "descrição original" (histórico) do lançamento. Nunca é alterado. */
  description: string
  /** Descrição amigável curta sugerida (ex.: "Pix - Enviado"), separada da contraparte — vira a "Descrição" editável. */
  friendlyDescription: string
  /** Nome da pessoa/empresa/estabelecimento relacionado, quando identificável. */
  counterparty?: string
  /** Valor absoluto (sempre positivo); null se não reconhecido. */
  amount: number | null
  direction: 'entrada' | 'saida' | null
  document?: string
  /** Saldo informado na própria linha (quando existir) — apenas para exibição. */
  balance?: number
  /** Nome do arquivo de origem — preenchido pelo assistente de importação ao processar vários arquivos. */
  sourceFile?: string
  rawFields: Record<string, string>
}

export interface ParsedStatement {
  kind: ImportFileKind
  /** true quando conseguimos identificar as colunas essenciais sem intervenção manual. */
  autoIdentified: boolean
  rows: ParsedStatementRow[]
  /** Cabeçalhos de coluna, quando aplicável (csv/xls/xlsx/txt) — usados na tela de mapeamento. */
  headers?: string[]
  /** Linhas cruas (para reprocessar após mapeamento manual). */
  rawRows?: string[][]
  /** Saldo informado no extrato (ex.: LEDGERBAL do OFX) — puramente informativo, nunca aplicado automaticamente. */
  statementBalance?: { amount: number; asOfDate: string | null }
  /** Linhas do PDF que não puderam ser associadas com segurança a uma movimentação — nunca viram
   * lançamento sozinhas; ficam disponíveis para revisão manual na prévia. */
  unrecognizedLines?: string[]
  /** "Saldo anterior" encontrado no PDF (quando existir). Diferente de `statementBalance`: aqui a
   * usuária pode optar explicitamente por usá-lo como saldo de referência da conta — nunca aplicado
   * automaticamente. */
  pdfPreviousBalance?: { amount: number; asOfDate: string | null }
  error?: string
}

const SUPPORTED_EXTENSIONS: Record<string, ImportFileKind> = {
  ofx: 'ofx',
  ofc: 'ofc',
  csv: 'csv',
  xls: 'xls',
  xlsx: 'xlsx',
  txt: 'txt',
  pdf: 'pdf',
}

export function detectFileKind(fileName: string): ImportFileKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return SUPPORTED_EXTENSIONS[ext] ?? null
}

export function supportedExtensionsLabel(): string {
  return Object.keys(SUPPORTED_EXTENSIONS)
    .map((e) => `.${e}`)
    .join(', ')
}

// ---------- utilidades comuns ----------

function stripAccents(s: string): string {
  const diacritics = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return s.normalize('NFD').replace(diacritics, '')
}

function normalize(s: string): string {
  return stripAccents(s).toLowerCase().trim()
}

export function parseFlexibleDate(raw: string): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  // yyyy-mm-dd (com ou sem hora)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // dd/mm/yyyy ou dd-mm-yyyy (aceita ano com 2 ou 4 dígitos)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) {
    const d = m[1].padStart(2, '0')
    const mo = m[2].padStart(2, '0')
    let y = m[3]
    if (y.length === 2) y = `20${y}`
    return `${y}-${mo}-${d}`
  }
  return null
}

function parseAmountCell(raw: string): number {
  return parseCurrencyInput(raw)
}

// ---------- OFX / OFC ----------
// Extratos OFX frequentemente não são XML bem-formado (tags sem fechamento),
// então usamos extração tolerante por regex em vez de um parser XML estrito.

function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i')
  const m = block.match(re)
  return m ? m[1].trim() : undefined
}

function parseOfxDate(raw?: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d]/g, '').slice(0, 8)
  if (digits.length < 8) return null
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

export function parseOfx(text: string, kind: 'ofx' | 'ofc' = 'ofx'): ParsedStatement {
  const rows: ParsedStatementRow[] = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []

  blocks.forEach((block, i) => {
    const trnType = extractTag(block, 'TRNTYPE')
    const dtposted = extractTag(block, 'DTPOSTED')
    const trnamt = extractTag(block, 'TRNAMT')
    const fitid = extractTag(block, 'FITID')
    const name = extractTag(block, 'NAME')
    const memo = extractTag(block, 'MEMO')
    const payee = extractTag(block, 'PAYEE')
    const checknum = extractTag(block, 'CHECKNUM')
    const refnum = extractTag(block, 'REFNUM')

    const amountNum = trnamt ? Number(trnamt.replace(',', '.')) : NaN
    // Histórico original: preserva tudo que o extrato trouxe (NAME + MEMO), sem perder nada.
    const description = [name, memo].filter(Boolean).join(' - ') || trnType || 'Movimentação'
    const fallbackLabel = name || trnType || 'Movimentação'

    // Contraparte: prioriza PAYEE (quando o banco preenche esse campo estruturado); senão tenta
    // extrair do MEMO (onde costuma vir o nome de quem enviou/recebeu); senão tenta do NAME.
    let friendlyDescription = fallbackLabel
    let counterparty = payee || undefined
    if (!counterparty) {
      const fromMemo = deriveImportedDescription(memo || '', fallbackLabel)
      counterparty = fromMemo.counterparty
    }
    if (!counterparty) {
      const fromName = deriveImportedDescription(name || '', fallbackLabel)
      counterparty = fromName.counterparty
    }
    if (name) friendlyDescription = name

    rows.push({
      index: i,
      date: parseOfxDate(dtposted),
      description,
      friendlyDescription,
      counterparty,
      amount: Number.isNaN(amountNum) ? null : Math.abs(amountNum),
      direction: Number.isNaN(amountNum) ? null : amountNum >= 0 ? 'entrada' : 'saida',
      document: fitid || checknum || refnum || undefined,
      rawFields: {
        TRNTYPE: trnType ?? '',
        DTPOSTED: dtposted ?? '',
        TRNAMT: trnamt ?? '',
        NAME: name ?? '',
        MEMO: memo ?? '',
        PAYEE: payee ?? '',
        FITID: fitid ?? '',
        REFNUM: refnum ?? '',
      },
    })
  })

  // Saldo informado (LEDGERBAL) — puramente informativo. Nunca aplicado
  // automaticamente ao saldo de referência da conta, mesmo quando BALAMT = 0
  // (alguns exports zeram esse campo mesmo com saldo real diferente de zero).
  let statementBalance: ParsedStatement['statementBalance']
  const ledgerMatch = text.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|$)/i)
  if (ledgerMatch) {
    const balamt = extractTag(ledgerMatch[1], 'BALAMT')
    const dtasof = extractTag(ledgerMatch[1], 'DTASOF')
    if (balamt !== undefined) {
      const n = Number(balamt.replace(',', '.'))
      if (!Number.isNaN(n)) {
        statementBalance = { amount: n, asOfDate: parseOfxDate(dtasof) }
      }
    }
  }

  return {
    kind,
    autoIdentified: rows.length > 0,
    rows,
    statementBalance,
    error: rows.length === 0 ? 'Não foi possível identificar movimentações neste arquivo OFX/OFC.' : undefined,
  }
}

// ---------- CSV / TXT (texto delimitado) ----------

function detectDelimiter(sampleLines: string[]): string {
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestScore = -1
  for (const c of candidates) {
    const counts = sampleLines.map((l) => l.split(c).length)
    const consistent = counts.length > 0 && counts.every((n) => n === counts[0]) && counts[0] > 1
    const score = consistent ? counts[0] : 0
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((s) => s.trim())
}

function looksLikeHeaderRow(row: string[]): boolean {
  return row.some((cell) => /[a-zA-Z]/.test(cell) && !/^\d{1,2}[/-]\d{1,2}/.test(cell))
}

export function parseDelimitedText(text: string, kind: 'csv' | 'txt'): ParsedStatement {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '')
  if (lines.length === 0) {
    return { kind, autoIdentified: false, rows: [], error: 'Arquivo vazio.' }
  }
  const delimiter = detectDelimiter(lines.slice(0, Math.min(10, lines.length)))
  const table = lines.map((l) => splitDelimitedLine(l, delimiter))

  const first = table[0]
  const hasHeader = looksLikeHeaderRow(first)
  const headers = hasHeader ? first : first.map((_, i) => `Coluna ${i + 1}`)
  const dataRows = hasHeader ? table.slice(1) : table

  return buildStatementFromTable(kind, headers, dataRows)
}

// ---------- XLS / XLSX ----------

export async function parseWorkbookFile(file: File, kind: 'xls' | 'xlsx'): Promise<ParsedStatement> {
  const buffer = await file.arrayBuffer()
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return { kind, autoIdentified: false, rows: [], error: 'Não foi possível ler esta planilha.' }
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { kind, autoIdentified: false, rows: [], error: 'Planilha vazia.' }
  const sheet = workbook.Sheets[sheetName]
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })
  const cleaned = table.map((row) => (row ?? []).map((cell) => (cell === undefined || cell === null ? '' : String(cell).trim())))
  const nonEmpty = cleaned.filter((row) => row.some((c) => c !== ''))
  if (nonEmpty.length === 0) return { kind, autoIdentified: false, rows: [], error: 'Planilha vazia.' }

  const first = nonEmpty[0]
  const hasHeader = looksLikeHeaderRow(first)
  const headers = hasHeader ? first : first.map((_, i) => `Coluna ${i + 1}`)
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty

  return buildStatementFromTable(kind, headers, dataRows)
}

// ---------- construção comum a partir de uma tabela (csv/txt/xls/xlsx) ----------

function buildStatementFromTable(kind: ImportFileKind, headers: string[], dataRows: string[][]): ParsedStatement {
  const mapping = guessMapping(headers)
  const confident = isMappingConfident(mapping)

  if (!confident) {
    return { kind, autoIdentified: false, rows: [], headers, rawRows: dataRows }
  }

  const rows = buildRowsFromMapping(dataRows, headers, mapping)
  return { kind, autoIdentified: true, rows, headers, rawRows: dataRows }
}

/** Reconstrói as linhas interpretadas a partir de um mapeamento de colunas — usado tanto
 * na identificação automática quanto após a usuária confirmar o mapeamento manual. */
export function buildRowsFromMapping(
  dataRows: string[][],
  headers: string[],
  mapping: Partial<Record<MappableField, number>>,
): ParsedStatementRow[] {
  return dataRows.map((cols, i) => {
    const rawFields: Record<string, string> = {}
    headers.forEach((h, idx) => {
      rawFields[h] = cols[idx] ?? ''
    })

    const dateRaw = mapping.date !== undefined ? cols[mapping.date] ?? '' : ''
    const descRaw = mapping.description !== undefined ? cols[mapping.description] ?? '' : ''
    const amountRaw = mapping.amount !== undefined ? cols[mapping.amount] ?? '' : ''
    const directionRaw = mapping.direction !== undefined ? cols[mapping.direction] ?? '' : ''
    const documentRaw = mapping.document !== undefined ? cols[mapping.document] ?? '' : ''
    const balanceRaw = mapping.balance !== undefined ? cols[mapping.balance] ?? '' : ''

    const date = parseFlexibleDate(dateRaw)
    const amountParsed = amountRaw ? parseAmountCell(amountRaw) : NaN

    let direction: 'entrada' | 'saida' | null = null
    let amount: number | null = null
    if (!Number.isNaN(amountParsed)) {
      amount = Math.abs(amountParsed)
      if (directionRaw) {
        const normDir = normalize(directionRaw)
        if (/(^c$|credito|entrada|receb|deposito)/.test(normDir)) direction = 'entrada'
        else if (/(^d$|debito|saida|pagamento|envio)/.test(normDir)) direction = 'saida'
      }
      if (!direction) {
        direction = amountParsed >= 0 ? 'entrada' : 'saida'
      }
    }

    const balanceParsed = balanceRaw ? parseAmountCell(balanceRaw) : NaN
    const description = descRaw || 'Movimentação'
    const { friendly, counterparty } = deriveImportedDescription(description, 'Movimentação')

    return {
      index: i,
      date,
      description,
      friendlyDescription: friendly,
      counterparty,
      amount,
      direction,
      document: documentRaw || undefined,
      balance: Number.isNaN(balanceParsed) ? undefined : balanceParsed,
      rawFields,
    }
  })
}
