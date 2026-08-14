import type { Transaction } from '../../data/types'
import { formatCurrencySigned, formatDate } from '../../lib/format'
import { TransactionTypeBadge } from './TransactionTypeBadge'
import { TransactionStatusPill } from '../ui/StatusPill'

interface TransactionsTableProps {
  transactions: Transaction[]
  emptyMessage?: string
}

export function TransactionsTable({ transactions, emptyMessage = 'Nenhum lançamento encontrado.' }: TransactionsTableProps) {
  if (transactions.length === 0) {
    return <p className="py-10 text-center text-[14px] text-neutral-500">{emptyMessage}</p>
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5 lg:-mx-6 lg:px-6">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="text-[12px] uppercase tracking-wide text-neutral-400">
            <th className="pb-3 pr-4 font-medium">Data</th>
            <th className="pb-3 pr-4 font-medium">Descrição</th>
            <th className="pb-3 pr-4 font-medium">Tipo</th>
            <th className="pb-3 pr-4 font-medium">Valor</th>
            <th className="pb-3 pr-4 font-medium">Centro de custo</th>
            <th className="pb-3 pr-4 font-medium">Categoria</th>
            <th className="pb-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t border-[var(--border-hairline)] text-[13.5px]">
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-500 tabular-nums">{formatDate(t.date)}</td>
              <td className="max-w-[220px] truncate py-3 pr-4 font-medium text-neutral-800">{t.description}</td>
              <td className="py-3 pr-4">
                <TransactionTypeBadge kind={t.kind} />
              </td>
              <td
                className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums"
                style={{ color: t.direction === 'entrada' ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
              >
                {formatCurrencySigned(t.amount, t.direction)}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">{t.costCenter}</td>
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">{t.category}</td>
              <td className="py-3">
                <TransactionStatusPill status={t.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
