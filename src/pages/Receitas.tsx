import { useMemo, useState } from 'react'
import { TrendingUp, ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Select, PillToggle } from '../components/ui/FormField'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { TransactionFormModal, type TransactionFormValues } from '../components/transactions/TransactionFormModal'
import { resolveCostCenterName, resolveCategoryName } from '../components/transactions/TransactionsTable'
import { availableYears, monthEntriesSummary, monthKey, monthLabelLong, todayIso, nextCostCenterColor, type MonthEntriesSummary } from '../lib/aggregations'
import { formatCurrency, formatDate, parseCurrencyInput } from '../lib/format'
import { isInternalTransferKind, transactionKindMeta } from '../lib/transactionKind'
import type { Transaction } from '../db/models'

/** "Natureza/origem" exibida no modal de lançamentos — reaproveita o mesmo rótulo já usado no resto
 * do app para transferências internas e para os demais tipos de movimentação. */
function natureLabel(t: Transaction): string {
  return isInternalTransferKind(t.kind) ? 'Transferência entre contas próprias' : transactionKindMeta[t.kind].label
}

export default function Receitas() {
  const { accounts, transactions, costCenters, updateTransaction, deleteTransaction, addCostCenter, addCategory } = useData()
  const toast = useToast()
  const confirm = useConfirm()

  const [year, setYear] = useState(() => new Date(todayIso()).getFullYear())
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [openAccount, setOpenAccount] = useState<{ accountId: string; monthKey: string } | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [txModalOpen, setTxModalOpen] = useState(false)

  const yearOptions = useMemo(() => availableYears(transactions), [transactions])

  // Sempre os 12 meses do ano selecionado, na ordem escolhida — nunca altera as Transactions, só a
  // visualização. Cada resumo usa exclusivamente `transaction.date`.
  const monthSummaries = useMemo<MonthEntriesSummary[]>(() => {
    const list = Array.from({ length: 12 }, (_, i) => monthEntriesSummary(transactions, accounts, `${year}-${String(i + 1).padStart(2, '0')}`))
    return order === 'asc' ? list : [...list].reverse()
  }, [transactions, accounts, year, order])

  const openAccountEntity = openAccount ? accounts.find((a) => a.id === openAccount.accountId) : undefined
  // TODAS as entradas daquela conta/mês — inclui transferências recebidas entre contas próprias
  // (nunca escondidas), reembolsos, estornos etc.
  const openAccountItems = useMemo(() => {
    if (!openAccount) return []
    return transactions
      .filter((t) => t.accountId === openAccount.accountId && t.direction === 'entrada' && monthKey(t.date) === openAccount.monthKey)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }, [transactions, openAccount])
  const openAccountTotal = openAccountItems.reduce((s, t) => s + t.amount, 0)

  const handleCreateCostCenter = (values: { name: string; emoji: string }) =>
    addCostCenter({ ...values, color: nextCostCenterColor(costCenters.length) })

  const openTxEditor = (t: Transaction) => {
    setEditingTx(t)
    setTxModalOpen(true)
  }

  const handleTxSubmit = async (values: TransactionFormValues) => {
    if (!editingTx) return
    await updateTransaction(editingTx.id, {
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
    })
    toast.show('Lançamento atualizado.')
  }

  const handleDeleteTx = async () => {
    if (!editingTx) return
    const ok = await confirm({
      title: 'Excluir lançamento',
      description: `Excluir "${editingTx.description}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteTransaction(editingTx.id)
    setTxModalOpen(false)
    toast.show('Lançamento excluído.', 'info')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receitas"
        subtitle="Tudo o que entrou nas suas contas, organizado por mês — receita, transferência recebida, reembolso ou estorno."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-auto">
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <PillToggle
              value={order}
              onChange={setOrder}
              options={[
                { value: 'asc', label: 'Mais antigos primeiro' },
                { value: 'desc', label: 'Mais recentes primeiro' },
              ]}
            />
          </div>
        }
      />

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Nenhuma conta cadastrada"
            description="Cadastre uma conta bancária para começar a acompanhar suas receitas."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {monthSummaries.map((m) => (
            <Card key={m.key}>
              <CardTitle>{monthLabelLong(m.key)}</CardTitle>
              {m.byAccount.length === 0 ? (
                <p className="py-2 text-[13.5px] text-neutral-500">Nenhuma entrada neste mês.</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-sm">
                    <div>
                      <p className="text-[12px] text-neutral-400">Entradas no mês</p>
                      <p className="text-[19px] font-semibold tabular-nums text-neutral-900">{formatCurrency(m.totalEntradas)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-neutral-400" title="Dinheiro novo — não conta de novo transferências entre suas próprias contas">
                        Receita real
                      </p>
                      <p className="text-[19px] font-semibold tabular-nums text-neutral-900">{formatCurrency(m.receitaReal)}</p>
                    </div>
                  </div>
                  <ul className="divide-y divide-[var(--border-hairline)]">
                    {m.byAccount.map((a) => (
                      <li key={a.accountId}>
                        <button
                          type="button"
                          onClick={() => setOpenAccount({ accountId: a.accountId, monthKey: m.key })}
                          className="flex w-full items-center gap-2 py-2.5 text-left transition-colors hover:text-rose-700"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-neutral-800">{a.accountLabel}</span>
                          <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-neutral-800">{formatCurrency(a.total)}</span>
                          <ChevronRight size={15} className="shrink-0 text-neutral-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={openAccount !== null}
        onClose={() => setOpenAccount(null)}
        title={openAccountEntity && openAccount ? `${openAccountEntity.nickname || openAccountEntity.bank} — ${monthLabelLong(openAccount.monthKey)}` : ''}
        width="lg"
      >
        <div className="space-y-3">
          <p className="text-[13px] text-neutral-500">
            Total de entradas no mês: <strong className="font-semibold text-neutral-800">{formatCurrency(openAccountTotal)}</strong>
          </p>
          {openAccountItems.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-neutral-500">Nenhuma entrada encontrada.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-hairline)]">
              {openAccountItems.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openTxEditor(t)}
                    className="-mx-2 flex w-full items-start justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-[var(--color-neutral-100)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-neutral-800">{t.description}</p>
                      <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                        {[formatDate(t.date), t.counterparty, natureLabel(t), resolveCostCenterName(costCenters, t.costCenterId), resolveCategoryName(costCenters, t.costCenterId, t.categoryId)]
                          .filter(Boolean)
                          .filter((v) => v !== '—')
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[13.5px] font-semibold tabular-nums" style={{ color: 'var(--color-status-good)' }}>
                      {formatCurrency(t.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <TransactionFormModal
        open={txModalOpen}
        onClose={() => {
          setTxModalOpen(false)
          setEditingTx(null)
        }}
        onSubmit={handleTxSubmit}
        onDelete={editingTx ? handleDeleteTx : undefined}
        accounts={accounts}
        costCenters={costCenters}
        transaction={editingTx}
        onCreateCostCenter={handleCreateCostCenter}
        onCreateCategory={addCategory}
      />
    </div>
  )
}
