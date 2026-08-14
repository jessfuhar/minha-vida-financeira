import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/EmptyState'
import { formatCurrency, formatDate } from '../../lib/format'
import { categorySpendInMonth, monthKey, monthLabel, shiftMonthKey, todayIso } from '../../lib/aggregations'
import { transactionKindMeta } from '../../lib/transactionKind'
import { ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react'
import type { Account, CostCenter, Category, Transaction } from '../../db/models'

interface CategoryDetailModalProps {
  open: boolean
  onClose: () => void
  costCenter: CostCenter | null
  category: Category | null
  transactions: Transaction[]
  accounts: Account[]
}

export function CategoryDetailModal({ open, onClose, costCenter, category, transactions, accounts }: CategoryDetailModalProps) {
  const [month, setMonth] = useState(() => monthKey(todayIso()))

  const { total, count, items } = useMemo(() => {
    if (!costCenter || !category) return { total: 0, count: 0, items: [] as Transaction[] }
    return categorySpendInMonth(transactions, costCenter.id, category.id, month)
  }, [transactions, costCenter, category, month])

  if (!costCenter || !category) return null

  const accountName = (id: string) => {
    const acc = accounts.find((a) => a.id === id)
    return acc ? acc.nickname || acc.bank : '—'
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${category.name} — ${monthLabel(month)}`}
      subtitle={`Centro de custo: ${costCenter.emoji} ${costCenter.name}`}
      width="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-rose-50/60 px-4 py-3">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
            className="rounded-lg p-1.5 text-rose-700 hover:bg-white"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-[13px] text-neutral-500">
              {count} lançamento{count !== 1 ? 's' : ''}
            </p>
            <p className="font-display text-[18px] font-semibold text-neutral-900">{formatCurrency(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
            className="rounded-lg p-1.5 text-rose-700 hover:bg-white"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Sem lançamentos neste mês"
            description={`Nenhuma saída registrada em "${category.name}" em ${monthLabel(month)}.`}
          />
        ) : (
          <ul className="divide-y divide-[var(--border-hairline)]">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-neutral-800">{t.description}</p>
                  <p className="truncate text-[12px] text-neutral-500">
                    {formatDate(t.date)} · {accountName(t.accountId)} · {transactionKindMeta[t.kind]?.label}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{formatCurrency(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
