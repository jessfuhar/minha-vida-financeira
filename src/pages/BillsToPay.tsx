import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { BillStatusPill } from '../components/ui/StatusPill'
import { BillFormModal, type BillFormValues } from '../components/bills/BillFormModal'
import { MarkPaidModal } from '../components/bills/MarkPaidModal'
import { BulkClassifyModal } from '../components/transactions/BulkClassifyModal'
import { BulkActionBar } from '../components/ui/BulkActionBar'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { resolveCostCenterName, resolveCategoryName } from '../components/transactions/TransactionsTable'
import { formatCurrency, formatDate, parseCurrencyInput } from '../lib/format'
import { daysUntil, getBillDisplayStatus, todayIso } from '../lib/aggregations'
import { useSelection } from '../lib/useSelection'
import { Plus, Pencil, Trash2, CheckCircle2, ReceiptText, Repeat } from 'lucide-react'
import type { Bill } from '../db/models'
import type { BillStatus as DisplayBillStatus } from '../data/types'

const filters: { id: 'todas' | DisplayBillStatus; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'paga', label: 'Pagas' },
  { id: 'vencida', label: 'Vencidas' },
]

export default function BillsToPay() {
  const { accounts, costCenters, bills, addBill, updateBill, deleteBill, bulkUpdateBills, bulkDeleteBills, markBillPaid } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const selection = useSelection()

  const [active, setActive] = useState<(typeof filters)[number]['id']>('todas')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [payingBill, setPayingBill] = useState<Bill | null>(null)
  const [bulkModal, setBulkModal] = useState<'categoria' | 'centroDeCusto' | null>(null)

  const displayStatus = (b: Bill) => getBillDisplayStatus(b)

  const filtered = useMemo(
    () => (active === 'todas' ? bills : bills.filter((b) => displayStatus(b) === active)),
    [active, bills],
  )

  const totals = useMemo(() => {
    const pendente = bills.filter((b) => displayStatus(b) === 'pendente').reduce((s, b) => s + b.amount, 0)
    const vencida = bills.filter((b) => displayStatus(b) === 'vencida').reduce((s, b) => s + b.amount, 0)
    const paga = bills.filter((b) => b.status === 'paga').reduce((s, b) => s + b.amount, 0)
    return { pendente, vencida, paga }
  }, [bills])

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (b: Bill) => {
    setEditing(b)
    setModalOpen(true)
  }

  // Permite chegar aqui a partir de um resultado clicável da busca geral (/buscar), já abrindo a
  // conta a pagar correspondente — sem navegação quebrada.
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const targetId = (location.state as { openBillId?: string } | null)?.openBillId
    if (!targetId) return
    const bill = bills.find((b) => b.id === targetId)
    if (bill) openEdit(bill)
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleSubmit = async (values: BillFormValues) => {
    const payload = {
      name: values.name.trim(),
      originalDescription: values.originalDescription.trim() || undefined,
      amount: parseCurrencyInput(values.amount),
      dueDate: values.dueDate,
      accountId: values.accountId || null,
      costCenterId: values.costCenterId || null,
      categoryId: values.categoryId || null,
      recurring: values.recurring,
    }
    if (editing) {
      await updateBill(editing.id, payload)
      toast.show('Conta atualizada.')
    } else {
      await addBill(payload)
      toast.show('Conta a pagar criada.')
    }
  }

  const handleDelete = async (b: Bill) => {
    const ok = await confirm({
      title: 'Excluir conta a pagar',
      description: `Excluir "${b.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteBill(b.id)
    toast.show('Conta excluída.', 'info')
  }

  const handleConfirmPaid = async (opts: { createTransaction: boolean; accountId?: string }) => {
    if (!payingBill) return
    await markBillPaid(payingBill.id, { ...opts, date: todayIso() })
    toast.show('Conta marcada como paga.')
  }

  // ---------- Ações em massa ----------
  const handleBulkClassify = async (value: { costCenterId: string | null; categoryId: string | null }) => {
    const ids = selection.selectedIds
    await bulkUpdateBills(ids, value)
    toast.show(`${ids.length} conta${ids.length === 1 ? '' : 's'} atualizada${ids.length === 1 ? '' : 's'}.`)
    selection.clear()
  }

  const handleBulkDelete = async () => {
    const ids = selection.selectedIds
    const ok = await confirm({
      title: 'Excluir contas a pagar',
      description: `Tem certeza de que deseja excluir ${ids.length} conta${ids.length === 1 ? '' : 's'}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await bulkDeleteBills(ids)
    toast.show(`${ids.length} conta${ids.length === 1 ? '' : 's'} excluída${ids.length === 1 ? '' : 's'}.`, 'info')
    selection.clear()
  }

  const filteredIds = filtered.map((b) => b.id)
  const allFilteredSelected = selection.isAllSelected(filteredIds)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Suas contas fixas e variáveis, com vencimento e status."
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> Nova conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-neutral-500">A pagar</p>
            <p className="mt-1 font-display text-[19px] font-semibold text-neutral-900">{formatCurrency(totals.pendente)}</p>
          </div>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-neutral-500">Vencidas</p>
            <p className="mt-1 font-display text-[19px] font-semibold" style={{ color: 'var(--color-status-critical)' }}>
              {formatCurrency(totals.vencida)}
            </p>
          </div>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-neutral-500">Pagas</p>
            <p className="mt-1 font-display text-[19px] font-semibold" style={{ color: 'var(--color-status-good)' }}>
              {formatCurrency(totals.paga)}
            </p>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-hairline)] p-5 pb-4 lg:px-6">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={[
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                active === f.id ? 'bg-rose-700 text-white' : 'bg-[var(--color-neutral-100)] text-neutral-600 hover:bg-rose-50 hover:text-rose-800',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto p-5 pt-4 lg:p-6 lg:pt-4">
          {bills.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Nenhuma conta a pagar cadastrada"
              description="Cadastre suas contas fixas e variáveis para acompanhar os vencimentos."
              actionLabel="+ Nova conta"
              onAction={openNew}
            />
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-neutral-500">Nenhuma conta nesse filtro.</p>
          ) : (
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-neutral-400">
                  <th className="w-8 pb-3 pr-2 font-medium">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos"
                      checked={allFilteredSelected}
                      onChange={(e) => selection.toggleAll(filteredIds, e.target.checked)}
                    />
                  </th>
                  <th className="pb-3 pr-4 font-medium">Conta</th>
                  <th className="pb-3 pr-4 font-medium">Valor</th>
                  <th className="pb-3 pr-4 font-medium">Vencimento</th>
                  <th className="pb-3 pr-4 font-medium">Categoria</th>
                  <th className="pb-3 pr-4 font-medium">Centro de custo</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const status = displayStatus(b)
                  const days = daysUntil(b.dueDate)
                  return (
                    <tr key={b.id} className="border-t border-[var(--border-hairline)] text-[13.5px]">
                      <td className="py-3 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${b.name}`}
                          checked={selection.selected.has(b.id)}
                          onChange={() => selection.toggle(b.id)}
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800">
                          {b.name}
                          {b.recurring && <Repeat size={12} className="text-neutral-400" aria-label="Recorrente" />}
                        </span>
                        {b.originalDescription && (
                          <p className="mt-0.5 truncate text-[11.5px] text-neutral-400">{b.originalDescription}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums text-neutral-900">
                        {formatCurrency(b.amount)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">
                        {formatDate(b.dueDate)}
                        {status === 'pendente' && days <= 3 && days >= 0 && (
                          <span className="ml-2 text-[11.5px] font-medium" style={{ color: 'var(--color-status-serious)' }}>
                            {days === 0 ? 'vence hoje' : `em ${days}d`}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">
                        {resolveCategoryName(costCenters, b.costCenterId, b.categoryId)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">
                        {resolveCostCenterName(costCenters, b.costCenterId)}
                      </td>
                      <td className="py-3 pr-4">
                        <BillStatusPill status={status} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {status !== 'paga' && (
                            <button
                              type="button"
                              onClick={() => setPayingBill(b)}
                              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--color-status-good-bg)] hover:text-[var(--color-status-good)]"
                              aria-label="Marcar como paga"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                            aria-label="Editar conta"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(b)}
                            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                            aria-label="Excluir conta"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button size="sm" variant="secondary" onClick={() => setBulkModal('categoria')}>
          Categoria
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkModal('centroDeCusto')}>
          Centro de custo
        </Button>
        <Button size="sm" className="!bg-[var(--color-status-critical)] hover:!bg-[var(--color-status-critical)]" onClick={handleBulkDelete}>
          Excluir
        </Button>
      </BulkActionBar>

      <BulkClassifyModal
        open={bulkModal === 'categoria' || bulkModal === 'centroDeCusto'}
        onClose={() => setBulkModal(null)}
        mode={bulkModal === 'categoria' ? 'categoria' : 'centroDeCusto'}
        count={selection.selectedCount}
        costCenters={costCenters}
        onConfirm={handleBulkClassify}
      />

      <BillFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={
          editing
            ? () => {
                setModalOpen(false)
                handleDelete(editing)
              }
            : undefined
        }
        accounts={accounts}
        costCenters={costCenters}
        bill={editing}
      />

      <MarkPaidModal
        open={payingBill !== null}
        onClose={() => setPayingBill(null)}
        onConfirm={handleConfirmPaid}
        bill={payingBill}
        accounts={accounts}
      />
    </div>
  )
}
