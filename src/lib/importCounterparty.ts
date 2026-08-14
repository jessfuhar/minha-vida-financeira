/**
 * Extração da contraparte (pessoa, empresa, estabelecimento ou instituição) a partir do texto de
 * um extrato bancário, e separação entre uma "descrição amigável" curta e essa contraparte — usado
 * tanto para OFX/OFC (que já trazem NAME/MEMO/PAYEE separados) quanto para CSV/TXT/XLS/XLSX (que em
 * geral trazem tudo misturado numa única coluna de histórico).
 */

function stripAccents(s: string): string {
  const diacritics = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return s.normalize('NFD').replace(diacritics, '')
}

// Prefixos de tipo de movimentação reconhecidos no início do texto — removidos ao extrair a
// contraparte, e usados para reconhecer onde a "descrição" termina e a contraparte começa.
const TYPE_PREFIXES: RegExp[] = [
  /^pix\s*[-–]?\s*enviad[oa]\s*/i,
  /^pix\s*[-–]?\s*receb[ei]d[oa]\s*/i,
  /^pix\s*[-–]?\s*envio\s*/i,
  /^ted\s*[-–]?\s*/i,
  /^doc\s*[-–]?\s*/i,
  /^transfer[eê]ncia\s*(enviada|recebida)?\s*[-–]?\s*/i,
  /^pagamento\s*(de)?\s*(boleto|titulo|fatura)?\s*[-–]?\s*/i,
  /^boleto\s*[-–]?\s*/i,
  /^compra\s*(no)?\s*(cart[aã]o)?\s*(d[ée]bito|cr[ée]dito)?\s*[-–]?\s*/i,
  /^cart[aã]o\s*(de)?\s*(d[ée]bito|cr[ée]dito)\s*[-–]?\s*/i,
  /^saque\s*[-–]?\s*/i,
  /^dep[oó]sito\s*[-–]?\s*/i,
]

// Um conjunto pequeno de palavras/frases residuais que não são, de fato, uma contraparte — evita
// falsos positivos como transformar "Depósito em dinheiro" em contraparte "em dinheiro".
const STOP_REMAINDERS = new Set([
  'em dinheiro',
  'dinheiro',
  'diversos',
  'outros',
  'terceiros',
  'de terceiros',
  '01',
])

function normalizeForCompare(s: string): string {
  return stripAccents(s).toLowerCase().trim().replace(/\s+/g, ' ')
}

const LEADING_DATE_TIME_RE = /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\s*(\d{1,2}[:h]\d{2})?\s*/

/** Extrai o nome da contraparte (pessoa/empresa/estabelecimento) de um texto de extrato,
 * removendo prefixos de tipo de movimentação e marcações de data/hora conhecidas. Retorna
 * undefined quando não sobra nada que pareça, de fato, um nome. */
export function extractCounterparty(rawText: string | undefined | null): string | undefined {
  if (!rawText) return undefined
  let s = rawText.trim()
  let changed = true
  let iterations = 0
  while (changed && iterations < 6) {
    changed = false
    iterations++
    const before = s
    s = s.replace(LEADING_DATE_TIME_RE, '').trim()
    for (const p of TYPE_PREFIXES) {
      s = s.replace(p, '').trim()
    }
    s = s.replace(/^[-–/:,.\s]+/, '').trim()
    if (s !== before) changed = true
  }
  if (!s || s.length < 3) return undefined
  if (STOP_REMAINDERS.has(normalizeForCompare(s))) return undefined
  return s
}

/** Divide um texto bruto de extrato em uma descrição amigável curta (ex.: "Pix - Enviado") e a
 * contraparte associada (ex.: "FISIA COMERCIO DE PRODUTO"), quando ambas puderem ser identificadas
 * com segurança. Nunca perde informação: o texto bruto continua disponível como histórico original. */
export function deriveImportedDescription(rawText: string, fallbackLabel: string): { friendly: string; counterparty?: string } {
  const text = (rawText || '').trim()
  if (!text) return { friendly: fallbackLabel }

  const counterparty = extractCounterparty(text)
  if (!counterparty) return { friendly: text }

  const idx = text.toUpperCase().indexOf(counterparty.toUpperCase())
  if (idx <= 0) return { friendly: text, counterparty }

  let friendly = text.slice(0, idx).replace(/[-/:,.\s\d]+$/, '').trim()
  if (!friendly) friendly = fallbackLabel

  return { friendly, counterparty }
}

/** Normaliza uma contraparte para uso como chave de regra de classificação: maiúsculas, sem
 * acentos, pontuação reduzida, espaços colapsados e sufixos societários comuns equalizados
 * (ex.: "S.A." e "SA" viram a mesma coisa) — sem nunca alterar o texto original guardado no lançamento. */
export function normalizeCounterpartyKey(text: string): string {
  let s = stripAccents(text).toUpperCase().trim()
  s = s.replace(/[.,]/g, ' ')
  s = s.replace(/\bS\s*A\b/g, 'SA')
  s = s.replace(/\bLTDA\b\.?/g, 'LTDA')
  s = s.replace(/\bME\b\.?/g, 'ME')
  s = s.replace(/[^A-Z0-9 ]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
