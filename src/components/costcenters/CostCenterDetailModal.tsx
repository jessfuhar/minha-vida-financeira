import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { SearchInput } from '../ui/SearchInput'
import { EmptyState } from '../ui/EmptyState'
import { TransactionsTable } from '../transactions/TransactionsTable'
import { formatCurrency } from '../../lib/format'
import { categorySpendInMonth, categoryIncomeInMonth, costCenterSpendInMonth, costCenterIncomeInMonth } from '../../lib/aggregations'
import { matchesQuery, normalizeSearchText, transactionSearchFields } from '../../lib/textSearch'
import { sortTransactions, useTransactionSort } from '../../lib/sorting'
import { ChevronLeft, ArrowLeftRight, Pencil } from 'lucide-react'
import type { Account, Category, CostCenter, Transaction } from '../../db/models'

interface CostCenterDetailModalProps {
  open: boolean
  onClose: () => void
  costCenterId: string | null
  costCenters: CostCenter[]
  transactions: Transaction[]
  accounts: Account[]
  period: string
  periodLabel: string
  onAddCategory: (costCenterId: string, name: string) => Promise<Category>
  onRenameCategory: (costCenterId: string, categoryId: string, name: string) => void
  onDeleteCategory: (costCenterId: string, categoryId: string, categoryName: string) => void
  onEditCostCenter: (costCenter: CostCenter) => void
  onEditTransaction: (t: Transaction) => void
  onDeleteTransaction: (t: Transaction) => void
}

const NO_CATEGORY_ID = '__sem_categoria__'

/**
 * Modal grande (mesmo conceito visual da prévia de importação) com a hierarquia completa de um
 * Centro de Custo: Centro → Categorias → Lançamentos, tudo dentro do mesmo modal, sem virar página.
 */
export function CostCenterDetailModal({
  open,
  onClose,
  costCenterId,
  costCenters,
  transactions,
  accounts,
  period,
  periodLabel,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onEditCostCenter,
  onEditTransaction,
  onDeleteTransaction,
}: CostCenterDetailModalProps) {
  const costCenter = costCenters.find((c) => c.id === costCenterId) ?? null

  const [view, setView] = useState<'categories' | 'transactions'>('categories')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const sort = useTransactionSort()

  useEffect(() => {
    if (!open) return
    setView('categories')
    setActiveCategoryId(null)
    setSearch('')
    setAddingCategory(false)
    setNewCategoryName('')
    setRenamingCategoryId(null)
  }, [open, costCenterId])

  const activeCategory: Category | null =
    activeCategoryId === NO_CATEGORY_ID
      ? { id: NO_CATEGORY_ID, name: 'Sem categoria' }
      : costCenter?.categories.find((c) => c.id === activeCategoryId) ?? null

  const centerTotal = useMemo(
    () => (costCenter ? costCenterSpendInMonth(transactions, costCenter.id, period) : { total: 0, count: 0, items: [] as Transaction[] }),
    [transactions, costCenter, period],
  )

  // Entradas do centro de custo — sempre exibidas separadamente do gasto (centerTotal), nunca somadas.
  const centerIncome = useMemo(
    () => (costCenter ? costCenterIncomeInMonth(transactions, costCenter.id, period) : { total: 0, count: 0, items: [] as Transaction[] }),
    [transactions, costCenter, period],
  )

  const categoryRows = useMemo(() => {
    if (!costCenter) return []
    const rows = costCenter.categories.map((cat) => ({
      category: cat,
      spend: categorySpendInMonth(transactions, costCenter.id, cat.id, period),
      income: categoryIncomeInMonth(transactions, costCenter.id, cat.id, period),
    }))
    const uncategorizedSaida = centerTotal.items.filter((t) => !t.categoryId)
    const uncategorizedEntrada = centerIncome.items.filter((t) => !t.categoryId)
    if (uncategorizedSaida.length > 0 || uncategorizedEntrada.length > 0) {
      rows.push({
        category: { id: NO_CATEGORY_ID, name: 'Sem categoria' },
        spend: { total: uncategorizedSaida.reduce((s, t) => s + t.amount, 0), count: uncategorizedSaida.length, items: uncategorizedSaida },
        income: { total: uncategorizedEntrada.reduce((s, t) => s + t.amount, 0), count: uncategorizedEntrada.length, items: uncategorizedEntrada },
      })
    }
    return rows
  }, [costCenter, transactions, period, centerTotal, centerIncome])

  const visibleCategoryRows = useMemo(() => {
    const q = normalizeSearchText(search)
    const filtered = !q
      ? categoryRows
      : categoryRows.filter(
          (row) =>
            matchesQuery([row.category.name], search) ||
            row.spend.items.some((t) => matchesQuery(transactionSearchFields(t, costCenters, accounts), search)) ||
            row.income.items.some((t) => matchesQuery(transactionSearchFields(t, costCenters, accounts), search)),
        )
    // Categorias com movimentação (saída OU entrada) no período primeiro, depois as zeradas — nunca escondidas.
    return [...filtered].sort((a, b) => {
      const aCount = a.spend.count + a.income.count
      const bCount = b.spend.count + b.income.count
      if (aCount > 0 && bCount === 0) return -1
      if (aCount === 0 && bCount > 0) return 1
      return b.spend.total - a.spend.total
    })
  }, [categoryRows, search, costCenters, accounts])

  // Saídas ("gasto") da categoria aberta — total exibido em destaque, nunca somado às entradas.
  const activeCategorySpend = useMemo(() => {
    if (!costCenter || !activeCategory) return { total: 0, count: 0, items: [] as Transaction[] }
    if (activeCategory.id === NO_CATEGORY_ID) {
      const items = centerTotal.items.filter((t) => !t.categoryId)
      return { total: items.reduce((s, t) => s + t.amount, 0), count: items.length, items }
    }
    return categorySpendInMonth(transactions, costCenter.id, activeCategory.id, period)
  }, [costCenter, activeCategory, transactions, period, centerTotal])

  // Entradas da categoria aberta — sempre exibidas separadamente das saídas acima.
  const activeCategoryIncome = useMemo(() => {
    if (!costCenter || !activeCategory) return { total: 0, count: 0, items: [] as Transaction[] }
    if (activeCategory.id === NO_CATEGORY_ID) {
      const items = centerIncome.items.filter((t) => !t.categoryId)
      return { total: items.reduce((s, t) => s + t.amount, 0), count: items.length, items }
    }
    return categoryIncomeInMonth(transactions, costCenter.id, activeCategory.id, period)
  }, [costCenter, activeCategory, transactions, period, centerIncome])

  // Lista de lançamentos exibida na tabela: saídas + entradas juntas (a tabela já distingue a
  // direção de cada linha), só os totais do rodapé é que nunca se misturam.
  const activeCategoryAllItems = useMemo(
    () => [...activeCategorySpend.items, ...activeCategoryIncome.items],
    [activeCategorySpend.items, activeCategoryIncome.items],
  )

  const searchedCategoryItems = useMemo(
    () => activeCategoryAllItems.filter((t) => matchesQuery(transactionSearchFields(t, costCenters, accounts), search)),
    [activeCategoryAllItems, search, costCenters, accounts],
  )

  const sortedCategoryItems = useMemo(
    () => sortTransactions(searchedCategoryItems, sort.sortKey, sort.sortDir, costCenters),
    [searchedCategoryItems, sort.sortKey, sort.sortDir, costCenters],
  )

  if (!costCenter) return null

  const openCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId)
    setView('transactions')
  }

  const confirmAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) {
      setAddingCategory(false)
      return
    }
    await onAddCategory(costCenter.id, name)
    setNewCategoryName('')
    setAddingCategory(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${costCenter.emoji} ${costCenter.name}`}
      subtitle={
        view === 'categories'
          ? `${periodLabel} · Saídas ${formatCurrency(centerTotal.total)}${centerIncome.count > 0 ? ` · Entradas ${formatCurrency(centerIncome.total)}` : ''}`
          : `${costCenter.emoji} ${costCenter.name} → ${activeCategory?.name ?? ''} · ${periodLabel}`
      }
      width="xl"
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="shrink-0 space-y-3">
          {view === 'transactions' && (
            <button
              type="button"
              onClick={() => setView('categories')}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-neutral-100)] px-3 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-rose-50 hover:text-rose-800"
            >
              <ChevronLeft size={14} /> {costCenter.name}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder={view === 'categories' ? 'Pesquisar categoria ou lançamento...' : 'Pesquisar nesta categoria...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!w-[260px] !py-1.5 !text-[12.5px]"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-rose-700 hover:underline">
                Limpar
              </button>
            )}
            {view === 'categories' && (
              <button
                type="button"
                onClick={() => onEditCostCenter(costCenter)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-rose-700"
              >
                <Pencil size={12} /> Editar centro de custo
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {view === 'categories' ? (
            search && visibleCategoryRows.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="Nenhuma categoria encontrada" description={`Nenhum resultado para "${search}".`} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCategoryRows.map(({ category, spend, income }) => (
                  <div
                    key={category.id}
                    className="group flex flex-col gap-2 rounded-xl border border-[var(--border-hairline)] p-4 text-left transition-colors hover:border-rose-200"
                  >
                    {renamingCategoryId === category.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renameValue.trim()) {
                            onRenameCategory(costCenter.id, category.id, renameValue.trim())
                            setRenamingCategoryId(null)
                          }
                          if (e.key === 'Escape') setRenamingCategoryId(null)
                        }}
                        onBlur={() => {
                          if (renameValue.trim() && renameValue.trim() !== category.name) {
                            onRenameCategory(costCenter.id, category.id, renameValue.trim())
                          }
                          setRenamingCategoryId(null)
                        }}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-[13.5px] font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => openCategory(category.id)} className="text-left">
                          <p className="text-[14px] font-semibold text-neutral-900 hover:text-rose-700">{category.name}</p>
                        </button>
                        {category.id !== NO_CATEGORY_ID && (
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingCategoryId(category.id)
                                setRenameValue(category.name)
                              }}
                              className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-rose-700"
                              aria-label={`Renomear ${category.name}`}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCategory(costCenter.id, category.id, category.name)}
                              className="rounded-full p-1 text-neutral-400 hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                              aria-label={`Excluir ${category.name}`}
                            >
                              <span className="block text-[13px] leading-none">×</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => openCategory(category.id)} className="text-left">
                      <p className="text-[19px] font-semibold tabular-nums text-neutral-900">{formatCurrency(spend.total)}</p>
                      <p className="text-[12px] text-neutral-500">
                        {spend.count} lançamento{spend.count === 1 ? '' : 's'}
                      </p>
                      {income.count > 0 && (
                        <p className="mt-1 text-[12px] font-medium text-[var(--color-status-good)]">
                          + {formatCurrency(income.total)} em entrada{income.count === 1 ? '' : 's'}
                        </p>
                      )}
                    </button>
                  </div>
                ))}

                {addingCategory ? (
                  <div className="flex flex-col justify-center gap-2 rounded-xl border border-dashed border-rose-300 p-4">
                    <input
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmAddCategory()
                        if (e.key === 'Escape') {
                          setAddingCategory(false)
                          setNewCategoryName('')
                        }
                      }}
                      onBlur={confirmAddCategory}
                      placeholder="Nome da categoria"
                      className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategory(true)
                      setNewCategoryName('')
                    }}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-rose-300 p-4 text-rose-700 hover:bg-rose-50"
                  >
                    <span className="text-[20px] leading-none">+</span>
                    <span className="text-[12.5px] font-medium">Nova categoria</span>
                  </button>
                )}
              </div>
            )
          ) : sortedCategoryItems.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={search ? 'Nenhum lançamento encontrado' : 'Sem lançamentos nesta categoria'}
              description={
                search
                  ? `Nenhum resultado para "${search}" em ${periodLabel}.`
                  : `Nenhuma movimentação registrada em "${activeCategory?.name}" em ${periodLabel}.`
              }
            />
          ) : (
            <>
              <TransactionsTable
                transactions={sortedCategoryItems}
                costCenters={costCenters}
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
                sortKey={sort.sortKey}
                sortDir={sort.sortDir}
                onSortChange={sort.onSortChange}
              />
              {/* Saídas e Entradas sempre em linhas separadas — nunca somadas num único "Total". */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-[var(--border-hairline)] pt-3 text-[13.5px]">
                <span className="flex items-center gap-2">
                  <span className="text-neutral-500">Saídas</span>
                  <span className="font-semibold tabular-nums text-neutral-900">{formatCurrency(activeCategorySpend.total)}</span>
                </span>
                {activeCategoryIncome.count > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="text-neutral-500">Entradas</span>
                    <span className="font-semibold tabular-nums text-[var(--color-status-good)]">{formatCurrency(activeCategoryIncome.total)}</span>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
