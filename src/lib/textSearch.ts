/**
 * Normalização e correspondência de texto para busca — usada tanto na pesquisa dentro do Fluxo de
 * Caixa/Centros de Custo quanto na busca geral do sistema. Centralizado aqui para que toda busca no
 * app se comporte da mesma forma: sem diferenciar maiúsculas/minúsculas, sem diferenciar acentos,
 * e por correspondência parcial (substring). Nunca altera o texto original exibido na tela — só o
 * usa para comparar.
 */
import type { Transaction, CostCenter, Account } from '../db/models'
import { resolveCostCenterName, resolveCategoryName } from '../components/transactions/TransactionsTable'
import { transactionKindMeta } from './transactionKind'

export function normalizeSearchText(s: string | undefined | null): string {
  if (!s) return ''
  const diacritics = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return s
    .normalize('NFD')
    .replace(diacritics, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** true quando `query` (normalizada) aparece como substring em pelo menos um dos campos informados. */
export function matchesQuery(fields: Array<string | undefined | null>, query: string): boolean {
  const q = normalizeSearchText(query)
  if (!q) return true
  return fields.some((f) => normalizeSearchText(f).includes(q))
}

/** Todos os campos de um lançamento relevantes para busca textual — descrição, contraparte,
 * histórico original, documento, categoria, centro de custo, conta e tipo da movimentação. */
export function transactionSearchFields(t: Transaction, costCenters: CostCenter[], accounts: Account[]): Array<string | undefined | null> {
  const account = accounts.find((a) => a.id === t.accountId)
  return [
    t.description,
    t.counterparty,
    t.originalDescription,
    t.document,
    resolveCostCenterName(costCenters, t.costCenterId),
    resolveCategoryName(costCenters, t.costCenterId, t.categoryId),
    account?.nickname,
    account?.bank,
    transactionKindMeta[t.kind]?.label,
  ]
}
