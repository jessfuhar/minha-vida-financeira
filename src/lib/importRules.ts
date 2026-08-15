/**
 * Regras de classificação aprendidas: quando a usuária classifica uma movimentação de uma
 * contraparte específica (ex.: "COPEL DISTRIBUICAO S.A." → Energia / Casa), guardamos essa escolha
 * e sugerimos automaticamente na próxima vez que a mesma contraparte aparecer — nunca de forma
 * genérica por tipo de movimentação (ex.: nunca "Pix enviado" → Energia).
 */
import type { ClassificationRule, Transaction } from '../db/models'
import { ruleKeyFromCounterparty } from './importCounterparty'

/** Procura, entre as regras ativas, a que corresponde à contraparte informada. Correspondência
 * exata pelo padrão normalizado (nunca por data/hora/valor/documento — ver `ruleKeyFromCounterparty`)
 * — evita generalizações perigosas (ex.: "MERCADO" casando com qualquer estabelecimento que
 * contenha essa palavra), e reconhece a mesma contraparte em datas/valores diferentes. */
export function findMatchingRule(counterparty: string | undefined, rules: ClassificationRule[]): ClassificationRule | undefined {
  const key = ruleKeyFromCounterparty(counterparty)
  if (!key) return undefined
  return rules.find((r) => r.active && r.pattern === key)
}

/** Agrupa transações/linhas por contraparte normalizada — usado para não criar regras duplicadas
 * quando uma ação em massa cobre várias movimentações da mesma contraparte de uma vez. */
export function groupByNormalizedCounterparty<T>(items: T[], getCounterparty: (item: T) => string | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const cp = getCounterparty(item)
    const key = ruleKeyFromCounterparty(cp)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

export interface HistoryClassification {
  costCenterId: string
  categoryId: string | null
}

/**
 * Constrói, a partir do histórico real de transações já classificadas, um índice contraparte
 * normalizada → Centro de Custo/Categoria — usado para sugerir a classificação na prévia de
 * importação quando não existe uma regra explícita salva para aquela contraparte. Calculado uma
 * única vez por importação (nunca por linha da prévia), para a tabela continuar rápida mesmo com
 * centenas de movimentações.
 *
 * Só entra no índice a contraparte cujo histórico for CONSISTENTE — sempre a mesma combinação de
 * Centro de Custo + Categoria. Quando o histórico é conflitante (ex.: "AMAZON.COM.BR" já classificada
 * ora como Pessoal/Compras, ora como Trabalho/Equipamentos), a contraparte fica de fora do índice —
 * nunca escolhemos uma das opções arbitrariamente.
 */
export function buildHistorySuggestionIndex(transactions: Transaction[]): Map<string, HistoryClassification> {
  const byKey = new Map<string, HistoryClassification | null>() // null = conflito, nunca sugere
  for (const t of transactions) {
    if (!t.costCenterId) continue
    const key = ruleKeyFromCounterparty(t.counterparty)
    if (!key) continue
    const combo: HistoryClassification = { costCenterId: t.costCenterId, categoryId: t.categoryId ?? null }
    const existing = byKey.get(key)
    if (existing === undefined) {
      byKey.set(key, combo)
    } else if (existing !== null && (existing.costCenterId !== combo.costCenterId || existing.categoryId !== combo.categoryId)) {
      byKey.set(key, null)
    }
  }
  const index = new Map<string, HistoryClassification>()
  for (const [key, value] of byKey) {
    if (value) index.set(key, value)
  }
  return index
}

export interface ClassificationSuggestion {
  costCenterId: string
  categoryId: string | null
  source: 'rule' | 'history'
  ruleId?: string
}

/**
 * Sugestão de classificação para uma linha da prévia de importação, seguindo a ordem de prioridade:
 * 1) regra explícita salva pela usuária (`findMatchingRule`) — sempre vence, mesmo com histórico
 *    conflitante; 2) histórico consistente da mesma contraparte (`buildHistorySuggestionIndex`);
 * 3) nenhuma sugestão, quando não houver segurança nenhuma das duas formas. Nunca usa data, hora,
 * valor, saldo, FITID ou número sequencial da movimentação como identidade da contraparte.
 */
export function suggestClassification(
  counterparty: string | undefined,
  rules: ClassificationRule[],
  historyIndex: Map<string, HistoryClassification>,
): ClassificationSuggestion | undefined {
  const rule = findMatchingRule(counterparty, rules)
  if (rule && (rule.costCenterId || rule.categoryId)) {
    return { costCenterId: rule.costCenterId ?? '', categoryId: rule.categoryId, source: 'rule', ruleId: rule.id }
  }
  const key = ruleKeyFromCounterparty(counterparty)
  if (!key) return undefined
  const fromHistory = historyIndex.get(key)
  if (!fromHistory) return undefined
  return { costCenterId: fromHistory.costCenterId, categoryId: fromHistory.categoryId, source: 'history' }
}
