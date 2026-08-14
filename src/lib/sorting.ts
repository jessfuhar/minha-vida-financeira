/**
 * Ordenação reutilizável para tabelas/listas de lançamentos — Fluxo de Caixa, Centros de Custo
 * (lançamentos de uma categoria) e Buscar. A ordenação sempre atua sobre o conjunto já filtrado
 * (período, conta, centro de custo, pesquisa) que for passado para ela — nunca busca dados novos.
 */
import { useState, useCallback } from 'react'
import type { Transaction, CostCenter } from '../db/models'
import { resolveCostCenterName, resolveCategoryName } from '../components/transactions/TransactionsTable'

export type TransactionSortKey = 'date' | 'amount' | 'description' | 'categoria' | 'centroDeCusto'
export type SortDir = 'asc' | 'desc'

/** Direção inicial sensata para cada coluna: datas/valores começam do "mais relevante primeiro"
 * (mais recente / maior), texto começa em ordem alfabética A→Z. */
export function defaultSortDir(key: TransactionSortKey): SortDir {
  return key === 'description' || key === 'categoria' || key === 'centroDeCusto' ? 'asc' : 'desc'
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })

export function sortTransactions(items: Transaction[], key: TransactionSortKey, dir: SortDir, costCenters: CostCenter[]): Transaction[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    switch (key) {
      case 'date': {
        if (a.date === b.date) return 0
        return (a.date < b.date ? -1 : 1) * factor
      }
      case 'amount':
        return (a.amount - b.amount) * factor
      case 'description':
        return collator.compare(a.description, b.description) * factor
      case 'categoria':
        return (
          collator.compare(
            resolveCategoryName(costCenters, a.costCenterId, a.categoryId),
            resolveCategoryName(costCenters, b.costCenterId, b.categoryId),
          ) * factor
        )
      case 'centroDeCusto':
        return collator.compare(resolveCostCenterName(costCenters, a.costCenterId), resolveCostCenterName(costCenters, b.costCenterId)) * factor
      default:
        return 0
    }
  })
}

/** Estado de ordenação de uma tabela de lançamentos — clicar na mesma coluna alterna asc/desc;
 * clicar numa coluna diferente troca a coluna e volta para a direção inicial dela. */
export function useTransactionSort(initialKey: TransactionSortKey = 'date', initialDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<TransactionSortKey>(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  const onSortChange = useCallback(
    (key: TransactionSortKey) => {
      setSortKey((prevKey) => {
        if (prevKey === key) {
          setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'))
          return prevKey
        }
        setSortDir(defaultSortDir(key))
        return key
      })
    },
    [],
  )

  return { sortKey, sortDir, onSortChange }
}
