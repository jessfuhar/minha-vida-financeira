import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { MonthYearSelector } from '../components/ui/MonthYearSelector'
import { CostCenterFormModal, type CostCenterFormValues } from '../components/costcenters/CostCenterFormModal'
import { CostCenterDetailModal } from '../components/costcenters/CostCenterDetailModal'
import { TransactionFormModal, type TransactionFormValues } from '../components/transactions/TransactionFormModal'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { usePeriod } from '../context/PeriodContext'
import { formatCurrency, parseCurrencyInput } from '../lib/format'
import { costCenterSpendInMonth, costCenterIncomeInMonth, nextCostCenterColor } from '../lib/aggregations'
import { matchesQuery, normalizeSearchText, transactionSearchFields } from '../lib/textSearch'
import { Info, Plus, Pencil, Layers } from 'lucide-react'
import type { CostCenter, Transaction } from '../db/models'

export default function CostCenters() {
  const {
    costCenters,
    transactions,
    accounts,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    addCategory,
    renameCategory,
    deleteCategory,
    updateTransaction,
    deleteTransaction,
    saveClassificationRule,
  } = useData()
  const { period, label: periodLabel } = usePeriod()
  const toast = useToast()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostCenter | null>(null)
  const [openCenterId, setOpenCenterId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (cc: CostCenter) => {
    setEditing(cc)
    setModalOpen(true)
  }

  // Permite chegar aqui a partir de um resultado clicável da busca geral (/buscar), já abrindo o
  // centro de custo correspondente — sem navegação quebrada.
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const targetId = (location.state as { openCostCenterId?: string } | null)?.openCostCenterId
    if (!targetId) return
    if (costCenters.some((c) => c.id === targetId)) setOpenCenterId(targetId)
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleSubmit = async (values: CostCenterFormValues) => {
    if (editing) {
      await updateCostCenter(editing.id, values)
      toast.show('Centro de custo atualizado.')
    } else {
      await addCostCenter({ ...values, color: nextCostCenterColor(costCenters.length) })
      toast.show('Centro de custo criado.')
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    const linked = transactions.filter((t) => t.costCenterId === editing.id).length
    const ok = await confirm({
      title: 'Excluir centro de custo',
      description:
        linked > 0
          ? `${linked} lançamento(s) usam "${editing.name}". Eles ficarão sem centro de custo. Deseja continuar?`
          : `Tem certeza que deseja excluir "${editing.name}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteCostCenter(editing.id)
    setModalOpen(false)
    setOpenCenterId((id) => (id === editing.id ? null : id))
    toast.show('Centro de custo excluído.', 'info')
  }

  const handleDeleteCategory = async (costCenterId: string, categoryId: string, categoryName: string) => {
    const linked = transactions.filter((t) => t.categoryId === categoryId).length
    const ok = await confirm({
      title: 'Excluir categoria',
      description:
        linked > 0
          ? `${linked} lançamento(s) usam "${categoryName}". Eles ficarão sem categoria. Deseja continuar?`
          : `Tem certeza que deseja excluir "${categoryName}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteCategory(costCenterId, categoryId)
  }

  // ---------- Editar lançamento a partir da lista de uma categoria (reaproveita o mesmo formulário
  // existente do Fluxo de Caixa) ----------
  const openEditTransaction = (t: Transaction) => {
    setEditingTx(t)
    setTxModalOpen(true)
  }

  const handleTxSubmit = async (values: TransactionFormValues, saveAsRule: boolean) => {
    if (!editingTx) return
    const payload = {
      direction: values.direction,
      kind: values.kind,
      amount: parseCurrencyInput(values.amount),
      date: values.date,
      description: values.description.trim(),
      originalDescription: values.originalDescription.trim() || undefined,
      counterparty: values.counterparty.trim() || undefined,
      document: values.document.trim() || undefined,
      accountId: values.accountId,
      costCenterId: values.costCenterId || null,
      categoryId: values.categoryId || null,
      note: values.note.trim() || undefined,
    }
    await updateTransaction(editingTx.id, payload)
    toast.show('Lançamento atualizado.')
    if (saveAsRule && payload.counterparty && payload.costCenterId) {
      await saveClassificationRule({ counterparty: payload.counterparty, categoryId: payload.categoryId, costCenterId: payload.costCenterId })
      toast.show('Regra de classificação salva.', 'info')
    }
  }

  const handleDeleteTransaction = async (t: Transaction) => {
    const ok = await confirm({
      title: 'Excluir lançamento',
      description: `Excluir "${t.description}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteTransaction(t.id)
    toast.show('Lançamento excluído.', 'info')
  }

  const centerRows = useMemo(
    () =>
      costCenters.map((cc) => ({
        costCenter: cc,
        spend: costCenterSpendInMonth(transactions, cc.id, period),
        // Entradas do centro — exibidas separadamente do gasto no card, nunca somadas a ele.
        income: costCenterIncomeInMonth(transactions, cc.id, period),
      })),
    [costCenters, transactions, period],
  )

  const visibleCenterRows = useMemo(() => {
    const q = normalizeSearchText(search)
    if (!q) return centerRows
    return centerRows.filter(
      ({ costCenter, spend, income }) =>
        matchesQuery([costCenter.name, ...costCenter.categories.map((c) => c.name)], search) ||
        spend.items.some((t) => matchesQuery(transactionSearchFields(t, costCenters, accounts), search)) ||
        income.items.some((t) => matchesQuery(transactionSearchFields(t, costCenters, accounts), search)),
    )
  }, [centerRows, search, costCenters, accounts])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centros de Custo"
        subtitle="As grandes áreas da sua vida financeira — cada uma reúne várias categorias de gasto."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthYearSelector />
            <Button size="sm" onClick={openNew}>
              <Plus size={16} /> Novo centro de custo
            </Button>
          </div>
        }
      />

      <Card className="flex items-start gap-3 bg-rose-50/60">
        <Info size={18} className="mt-0.5 shrink-0 text-rose-700" />
        <p className="text-[13.5px] leading-relaxed text-neutral-700">
          <strong className="font-semibold">Centro de custo</strong> não é a mesma coisa que{' '}
          <strong className="font-semibold">categoria</strong>. O centro de custo representa a área geral (ex.: Casa),
          enquanto a categoria representa o tipo específico de gasto dentro dela (ex.: Energia, Internet, Alimentação).
          Clique num centro para ver suas categorias e lançamentos de {periodLabel}.
        </p>
      </Card>

      {costCenters.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="Nenhum centro de custo cadastrado"
            description="Crie centros de custo como Casa, Pessoal ou Trabalho para organizar seus gastos."
            actionLabel="+ Novo centro de custo"
            onAction={openNew}
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Pesquisar centro, categoria ou lançamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!w-[280px] !py-1.5 !text-[12.5px]"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-rose-700 hover:underline">
                Limpar
              </button>
            )}
          </div>

          {visibleCenterRows.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-[13.5px] text-neutral-500">Nenhum resultado para "{search}".</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCenterRows.map(({ costCenter: cc, spend, income }) => (
                <button
                  key={cc.id}
                  type="button"
                  onClick={() => setOpenCenterId(cc.id)}
                  className="card-interactive group flex flex-col gap-4 rounded-xl border border-[var(--border-hairline)] bg-white p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-rose-200 lg:p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-[19px]"
                        style={{ background: `color-mix(in srgb, ${cc.color} 14%, white)` }}
                      >
                        {cc.emoji}
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-neutral-900 group-hover:text-rose-700">{cc.name}</p>
                        <p className="text-[12px] text-neutral-500">
                          {cc.categories.length} categoria{cc.categories.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(cc)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          openEdit(cc)
                        }
                      }}
                      aria-label={`Editar ${cc.name}`}
                      className="rounded-full p-1.5 text-neutral-300 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-rose-700 group-hover:opacity-100"
                    >
                      <Pencil size={13} />
                    </span>
                  </div>

                  <div>
                    <p className="text-[12px] text-neutral-500">{periodLabel}</p>
                    <p className="font-display text-[22px] font-semibold tabular-nums text-neutral-900">{formatCurrency(spend.total)}</p>
                    <p className="text-[12.5px] text-neutral-500">
                      {spend.count} lançamento{spend.count === 1 ? '' : 's'}
                    </p>
                    {income.count > 0 && (
                      <p className="mt-1 text-[12.5px] font-medium text-[var(--color-status-good)]">
                        + {formatCurrency(income.total)} em entrada{income.count === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <CostCenterFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        costCenter={editing}
      />

      <CostCenterDetailModal
        open={openCenterId !== null}
        onClose={() => setOpenCenterId(null)}
        costCenterId={openCenterId}
        costCenters={costCenters}
        transactions={transactions}
        accounts={accounts}
        period={period}
        periodLabel={periodLabel}
        onAddCategory={addCategory}
        onRenameCategory={renameCategory}
        onDeleteCategory={handleDeleteCategory}
        onEditCostCenter={(cc) => openEdit(cc)}
        onEditTransaction={openEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />

      {/* Renderizado depois do CostCenterDetailModal para abrir "por cima" dele ao editar um
          lançamento a partir da lista de uma categoria — mesmo padrão já usado no Fluxo de Caixa. */}
      <TransactionFormModal
        open={txModalOpen}
        onClose={() => {
          setTxModalOpen(false)
          setEditingTx(null)
        }}
        onSubmit={handleTxSubmit}
        onDelete={
          editingTx
            ? async () => {
                setTxModalOpen(false)
                await handleDeleteTransaction(editingTx)
              }
            : undefined
        }
        accounts={accounts}
        costCenters={costCenters}
        transaction={editingTx}
      />
    </div>
  )
}
