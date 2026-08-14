/**
 * Mapeamento heurístico de colunas de um extrato (CSV/XLS/XLSX/TXT) para os
 * campos que o sistema entende. Bancos diferentes usam nomes de coluna
 * diferentes — por isso tentamos reconhecer por uma lista de apelidos antes
 * de pedir para a usuária mapear manualmente.
 */

export type MappableField = 'date' | 'description' | 'amount' | 'direction' | 'document' | 'balance'

export const mappableFieldLabel: Record<MappableField, string> = {
  date: 'Data',
  description: 'Descrição / histórico',
  amount: 'Valor',
  direction: 'Entrada ou saída',
  document: 'Documento / identificador',
  balance: 'Saldo',
}

export const REQUIRED_MAPPABLE_FIELDS: MappableField[] = ['date', 'description', 'amount']
export const OPTIONAL_MAPPABLE_FIELDS: MappableField[] = ['direction', 'document', 'balance']

const ALIASES: Record<MappableField, string[]> = {
  date: ['data', 'date', 'dt', 'data lancamento', 'data do lancamento', 'data mov', 'data movimento', 'dtposted'],
  description: [
    'descricao',
    'descricao',
    'historico',
    'lancamento',
    'memo',
    'name',
    'discriminacao',
    'detalhes',
    'observacao',
    'complemento',
  ],
  amount: ['valor', 'value', 'amount', 'vlr', 'valor r$', 'montante', 'valor(r$)'],
  direction: ['tipo', 'entrada/saida', 'entrada saida', 'e/s', 'd/c', 'debito/credito', 'natureza', 'sinal'],
  document: ['documento', 'doc', 'identificador', 'id', 'numero doc', 'nsu', 'fitid', 'num doc', 'num documento'],
  balance: ['saldo', 'balance', 'saldo final', 'saldo apos', 'saldo do dia'],
}

const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')

export function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Tenta identificar, para cada campo do sistema, qual índice de coluna corresponde a ele. */
export function guessMapping(headers: string[]): Partial<Record<MappableField, number>> {
  const mapping: Partial<Record<MappableField, number>> = {}
  const normalized = headers.map(normalizeHeader)
  const fields: MappableField[] = ['date', 'description', 'amount', 'direction', 'document', 'balance']

  for (const field of fields) {
    const aliases = ALIASES[field].map(normalizeHeader)
    let bestIndex = -1
    // 1ª passada: igualdade exata
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        bestIndex = i
        break
      }
    }
    // 2ª passada: contém o apelido como substring
    if (bestIndex < 0) {
      for (let i = 0; i < normalized.length; i++) {
        if (aliases.some((a) => normalized[i].includes(a))) {
          bestIndex = i
          break
        }
      }
    }
    if (bestIndex >= 0) mapping[field] = bestIndex
  }
  return mapping
}

/** true quando identificamos com confiança as colunas essenciais (data, descrição, valor), sem precisar de mapeamento manual. */
export function isMappingConfident(mapping: Partial<Record<MappableField, number>>): boolean {
  return REQUIRED_MAPPABLE_FIELDS.every((f) => mapping[f] !== undefined)
}
