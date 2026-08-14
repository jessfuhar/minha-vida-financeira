import { Pencil, Trash2 } from 'lucide-react'
import type { Transaction, CostCenter } from '../../db/models'
import { formatCurrencySigned, formatDate } from '../../lib/format'
import { TransactionTypeBadge } from './TransactionTypeBadge'
import { TransactionStatusPill } from '../ui/StatusPill'
import { transactionKindMeta } from '../../lib/transactionKind'

interface TransactionsTableProps {
  transactions: Transaction[]
  costCenters: CostCenter[]
  emptyMessage?: string
  onEdit?: (t: Transaction) => void
  onDelete?: (t: Transaction) => void
}

export function resolveCostCenterName(costCenters: CostCenter[], costCenterId: string | null): string {
  if (!costCenterId) return '—'
  return costCenters.find((c) => c.id === costCenterId)?.name ?? '—'
}

export function resolveCategoryName(costCenters: CostCenter[], costCenterId: string | null, categoryId: string | null): string {
  if (!costCenterId || !categoryId) return '—'
  const cc = costCenters.find((c) => c.id === costCenterId)
  return cc?.categories.find((cat) => cat.id === categoryId)?.name ?? '—'
}

export function TransactionsTable({
  transactions,
  costCenters,
  emptyMessage = 'Nenhum lançamento encontrado.',
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  if (transactions.length === 0) {
    return <p className="py-10 text-center text-[14px] text-neutral-500">{emptyMessage}</p>
  }

  const showActions = Boolean(onEdit || onDelete)

  return (
    <div className="-mx-5 overflow-x-auto px-5 lg:-mx-6 lg:px-6">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="text-[12px] uppercase tracking-wide text-neutral-400">
            <th className="pb-3 pr-4 font-medium">Data</th>
            <th className="pb-3 pr-4 font-medium">Descrição</th>
            <th className="pb-3 pr-4 font-medium">Tipo</th>
            <th className="pb-3 pr-4 font-medium">Valor</th>
            <th className="pb-3 pr-4 font-medium">Centro de custo</th>
            <th className="pb-3 pr-4 font-medium">Categoria</th>
            <th className="pb-3 font-medium">Status</th>
            {showActions && <th className="pb-3 pl-4 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t border-[var(--border-hairline)] text-[13.5px]">
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-500 tabular-nums">{formatDate(t.date)}</td>
              <td className="max-w-[220px] py-3 pr-4">
                <p className="truncate font-medium text-neutral-800">
                  {t.description}
                  {t.source === 'importado' && (
                    <span className="ml-1.5 rounded-full bg-[var(--color-neutral-100)] px-1.5 py-0.5 align-middle text-[10px] font-medium text-neutral-500">
                      Importado
                    </span>
                  )}
                </p>
                {(t.originalDescription || t.kind) && (
                  <p className="truncate text-[11.5px] text-neutral-400">
                    {[t.originalDescription, transactionKindMeta[t.kind]?.label].filter(Boolean).join(' · ')}
                  </p>
                )}
              </td>
              <td className="py-3 pr-4">
                <TransactionTypeBadge kind={t.kind} />
              </td>
              <td
                className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums"
                style={{ color: t.direction === 'entrada' ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
              >
                {formatCurrencySigned(t.amount, t.direction)}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">{resolveCostCenterName(costCenters, t.costCenterId)}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">{resolveCategoryName(costCenters, t.costCenterId, t.categoryId)}</td>
              <td className="py-3">
                <TransactionStatusPill status={t.status} />
              </td>
              {showActions && (
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(t)}
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Editar lançamento"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(t)}
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                        aria-label="Excluir lançamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
