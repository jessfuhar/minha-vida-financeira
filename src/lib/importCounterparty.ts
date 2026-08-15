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

// Mesmos prefixos de TYPE_PREFIXES, mas ancorados ao FINAL do texto — alguns extratos (sobretudo
// PDF) trazem o tipo de movimentação depois do nome (ex.: "26/01 14:53 00013541494913 CARLOS HENR
// Pix - Enviado"), não antes.
const TRAILING_TYPE_SUFFIXES: RegExp[] = [
  /\s*pix\s*[-–]?\s*enviad[oa]\s*$/i,
  /\s*pix\s*[-–]?\s*receb[ei]d[oa]\s*$/i,
  /\s*pix\s*[-–]?\s*envio\s*$/i,
  /\s*ted\s*[-–]?\s*$/i,
  /\s*doc\s*[-–]?\s*$/i,
  /\s*transfer[eê]ncia\s*(enviada|recebida)?\s*[-–]?\s*$/i,
  /\s*pagamento\s*(de)?\s*(boleto|titulo|fatura)?\s*[-–]?\s*$/i,
  /\s*boleto\s*[-–]?\s*$/i,
  /\s*compra\s*(no)?\s*(cart[aã]o)?\s*(d[ée]bito|cr[ée]dito)?\s*[-–]?\s*$/i,
  /\s*cart[aã]o\s*(de)?\s*(d[ée]bito|cr[ée]dito)\s*[-–]?\s*$/i,
  /\s*saque\s*[-–]?\s*$/i,
  /\s*dep[oó]sito\s*[-–]?\s*$/i,
]

// Documentos/identificadores de transação (FITID, número sequencial, comprovante) costumam ser
// uma sequência longa de dígitos isolada — nunca fazem parte da identidade de uma contraparte,
// então nunca podem entrar numa regra de classificação automática.
const STANDALONE_LONG_DIGITS_RE = /(^|\s)\d{6,}(?=\s|$)/g

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

/**
 * Limpa uma contraparte antes dela virar identidade de uma regra de classificação — nunca deixa
 * data, hora, valor ou documento/identificador variável (ex.: FITID, número sequencial) contaminar
 * o texto usado para reconhecer "a mesma pessoa/empresa" em movimentações futuras. Isso é uma
 * segunda camada de proteção: mesmo que o campo de contraparte já venha "sujo" de algum formato de
 * extrato (comum em PDFs, onde o texto bruto vem como "26/01 14:53 00013541494913 CARLOS HENR
 * Pix - Enviado"), a regra em si nunca usa esses pedaços voláteis como chave.
 *
 * Deliberadamente NÃO tenta distinguir um identificador estável da contraparte (ex.: CPF/CNPJ
 * cadastrado) de um número de referência da transação (FITID) — como não há um sinal confiável
 * para diferenciar os dois em texto de extrato genérico, e usar o número errado criaria regras que
 * nunca mais casam com nada, a escolha mais segura é nunca usar nenhum dígito longo como parte da
 * identidade automática.
 */
export function sanitizeCounterpartyForRule(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  let s = raw.trim()
  let changed = true
  let iterations = 0
  while (changed && iterations < 8) {
    changed = false
    iterations++
    const before = s
    s = s.replace(LEADING_DATE_TIME_RE, '').trim()
    for (const p of TYPE_PREFIXES) s = s.replace(p, '').trim()
    for (const p of TRAILING_TYPE_SUFFIXES) s = s.replace(p, '').trim()
    s = s.replace(STANDALONE_LONG_DIGITS_RE, ' ').trim()
    s = s.replace(/^[-–/:,.\s]+/, '').replace(/[-–/:,.\s]+$/, '').trim()
    s = s.replace(/\s+/g, ' ')
    if (s !== before) changed = true
  }
  if (!s || s.length < 2) return undefined
  if (STOP_REMAINDERS.has(normalizeForCompare(s))) return undefined
  return s
}

/** Combina a limpeza de `sanitizeCounterpartyForRule` com `normalizeCounterpartyKey` — é a função
 * que deve ser usada em todo lugar que cria ou consulta uma regra de classificação (nunca
 * `normalizeCounterpartyKey` sozinha sobre um texto ainda não sanitizado). Retorna undefined
 * quando não sobra nada seguro para usar como identidade. */
export function ruleKeyFromCounterparty(raw: string | undefined | null): string | undefined {
  const clean = sanitizeCounterpartyForRule(raw)
  if (!clean) return undefined
  const key = normalizeCounterpartyKey(clean)
  return key || undefined
}
