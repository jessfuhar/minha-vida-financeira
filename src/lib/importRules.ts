/**
 * Regras de classificação aprendidas: quando a usuária classifica uma movimentação de uma
 * contraparte específica (ex.: "COPEL DISTRIBUICAO S.A." → Energia / Casa), guardamos essa escolha
 * e sugerimos automaticamente na próxima vez que a mesma contraparte aparecer — nunca de forma
 * genérica por tipo de movimentação (ex.: nunca "Pix enviado" → Energia).
 */
import type { ClassificationRule } from '../db/models'
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
