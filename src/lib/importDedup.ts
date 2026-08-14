/**
 * Detecção de possíveis duplicidades ao importar um extrato.
 *
 * Regra: usa o documento/identificador único como referência primária quando
 * disponível; senão compara conta + data + valor + descrição original. Nunca
 * exclui automaticamente — apenas sinaliza "Possível duplicidade" para a
 * usuária decidir na tela de prévia.
 */
import type { Transaction } from '../db/models'
import type { ParsedStatementRow } from './importParsers'

function stripAccents(s: string): string {
  const diacritics = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return s.normalize('NFD').replace(diacritics, '')
}

function normalizeText(s: string): string {
  return stripAccents(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export interface DedupResult {
  isPossibleDuplicate: boolean
  reason?: string
}

interface BatchSeenEntry {
  date: string
  amount: number
  description: string
  document?: string
}

/** Avalia cada linha já parseada contra os lançamentos existentes na conta e contra
 * as linhas anteriores do mesmo arquivo, marcando possíveis duplicidades. */
export function detectDuplicates(
  rows: ParsedStatementRow[],
  accountId: string,
  existingTransactions: Transaction[],
): DedupResult[] {
  const existingForAccount = existingTransactions.filter((t) => t.accountId === accountId)
  const seenInBatch: BatchSeenEntry[] = []

  return rows.map((row) => {
    if (row.date === null || row.amount === null) {
      return { isPossibleDuplicate: false }
    }

    if (row.document) {
      const byDocument = existingForAccount.some((t) => t.document && t.document.trim() === row.document!.trim())
      if (byDocument) {
        return { isPossibleDuplicate: true, reason: 'Mesmo documento/identificador já lançado nesta conta.' }
      }
    }

    const normDesc = normalizeText(row.description)
    const byFields = existingForAccount.some(
      (t) =>
        t.date === row.date &&
        Math.abs(t.amount - (row.amount as number)) < 0.005 &&
        normalizeText(t.originalDescription || t.description) === normDesc,
    )

    const byBatch = seenInBatch.some(
      (s) =>
        s.date === row.date &&
        Math.abs(s.amount - (row.amount as number)) < 0.005 &&
        normalizeText(s.description) === normDesc &&
        (row.document || s.document ? s.document === row.document : true),
    )

    seenInBatch.push({ date: row.date, amount: row.amount, description: row.description, document: row.document })

    if (byFields || byBatch) {
      return { isPossibleDuplicate: true, reason: 'Conta + data + valor + descrição já registrados.' }
    }
    return { isPossibleDuplicate: false }
  })
}
