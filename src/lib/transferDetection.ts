/**
 * Detecção de possíveis transferências entre contas próprias — nunca vincula automaticamente,
 * apenas sugere pares prováveis (mesmo valor, direções opostas, contas diferentes, data igual ou
 * próxima) para confirmação explícita da usuária.
 */
import type { Transaction } from '../db/models'

export interface TransferCandidatePair {
  a: Transaction
  b: Transaction
  /** diferença em dias entre as datas das duas pontas */
  daysApart: number
  /** pontuação simples de confiança (maior = mais provável) */
  score: number
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime()
  const b = new Date(isoB).getTime()
  return Math.round(Math.abs(a - b) / (1000 * 60 * 60 * 24))
}

/** Já faz parte de uma transferência vinculada — não deve ser sugerido novamente. */
function isAlreadyLinked(t: Transaction): boolean {
  return Boolean(t.transferId)
}

/** Considera pares candidatos dentro de um conjunto de transações (tipicamente: as recém-importadas
 * de uma conta + o histórico já existente de outras contas). Critérios: contas diferentes, uma
 * entrada e uma saída, valores compatíveis (tolerância de 1 centavo) e datas iguais ou próximas
 * (até 3 dias) — nunca vincula sozinho, só produz sugestões para revisão explícita. */
export function findTransferCandidates(pool: Transaction[], maxDaysApart = 3): TransferCandidatePair[] {
  const candidates: TransferCandidatePair[] = []
  const entradas = pool.filter((t) => t.direction === 'entrada' && !isAlreadyLinked(t))
  const saidas = pool.filter((t) => t.direction === 'saida' && !isAlreadyLinked(t))

  const usedIds = new Set<string>()

  for (const out of saidas) {
    let best: { tx: Transaction; days: number; score: number } | null = null
    for (const inc of entradas) {
      if (usedIds.has(inc.id)) continue
      if (out.accountId === inc.accountId) continue
      if (Math.abs(out.amount - inc.amount) > 0.005) continue
      const days = daysBetween(out.date, inc.date)
      if (days > maxDaysApart) continue

      let score = 100 - days * 10
      const cpA = (out.counterparty || out.originalDescription || '').toLowerCase()
      const cpB = (inc.counterparty || inc.originalDescription || '').toLowerCase()
      if (cpA && cpB && (cpA.includes(cpB) || cpB.includes(cpA))) score += 20
      if (out.document && inc.document && out.document === inc.document) score += 30

      if (!best || score > best.score) best = { tx: inc, days, score }
    }
    if (best) {
      usedIds.add(best.tx.id)
      candidates.push({ a: out, b: best.tx, daysApart: best.days, score: best.score })
    }
  }

  return candidates.sort((x, y) => y.score - x.score)
}

/** Valida se duas transações escolhidas manualmente formam um par de transferência plausível:
 * contas diferentes, uma entrada e uma saída, valores compatíveis. */
export function validateTransferPair(a: Transaction, b: Transaction): { valid: boolean; reason?: string } {
  if (a.id === b.id) return { valid: false, reason: 'Selecione duas movimentações diferentes.' }
  if (a.accountId === b.accountId) return { valid: false, reason: 'As duas movimentações pertencem à mesma conta.' }
  if (a.direction === b.direction) return { valid: false, reason: 'É preciso uma entrada e uma saída.' }
  if (Math.abs(a.amount - b.amount) > 0.005) return { valid: false, reason: 'Os valores não são compatíveis.' }
  return { valid: true }
}

/** Usado durante a prévia de importação: procura, entre as transações já existentes (de OUTRAS
 * contas), uma possível contraparte de transferência para uma linha ainda não salva. Nunca vincula
 * sozinho — só devolve a melhor candidata para a usuária confirmar ou ignorar. */
export function findPartnerForNewRow(
  row: { date: string; amount: number; direction: 'entrada' | 'saida'; counterparty?: string },
  accountId: string,
  existingTransactions: Transaction[],
  maxDaysApart = 3,
): Transaction | undefined {
  const oppositeDirection = row.direction === 'entrada' ? 'saida' : 'entrada'
  const candidates = existingTransactions.filter(
    (t) =>
      t.accountId !== accountId &&
      t.direction === oppositeDirection &&
      !t.transferId &&
      Math.abs(t.amount - row.amount) < 0.005,
  )
  if (candidates.length === 0) return undefined

  let best: { tx: Transaction; score: number } | null = null
  for (const c of candidates) {
    const days = daysBetween(row.date, c.date)
    if (days > maxDaysApart) continue
    let score = 100 - days * 10
    const cp = (c.counterparty || c.originalDescription || '').toLowerCase()
    const rowCp = (row.counterparty || '').toLowerCase()
    if (cp && rowCp && (cp.includes(rowCp) || rowCp.includes(cp))) score += 20
    if (!best || score > best.score) best = { tx: c, score }
  }
  return best?.tx
}
