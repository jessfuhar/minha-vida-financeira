import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Pencil } from 'lucide-react'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { formatCurrency } from '../../lib/format'
import { spendingStatus } from '../../lib/aggregations'

interface SpendingLimitCardProps {
  title: string
  icon: LucideIcon
  spent: number
  limit?: number
  onEditLimit: () => void
  footer?: ReactNode
}

export function SpendingLimitCard({ title, icon: Icon, spent, limit, onEditLimit, footer }: SpendingLimitCardProps) {
  const hasLimit = typeof limit === 'number' && limit > 0
  const pct = hasLimit ? Math.round((spent / limit) * 100) : 0
  const status = spendingStatus(pct)
  const remaining = hasLimit ? limit - spent : undefined

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <Icon size={16} />
          </div>
          <h3 className="text-[14.5px] font-semibold text-neutral-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEditLimit}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
        >
          <Pencil size={12} /> {hasLimit ? 'Editar limite' : 'Definir limite'}
        </button>
      </div>

      {!hasLimit ? (
        <div className="rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-4 text-center">
          <p className="text-[13px] text-neutral-500">Nenhum limite definido</p>
          <p className="mt-1 font-display text-[17px] font-semibold text-neutral-800">{formatCurrency(spent)} gastos</p>
        </div>
      ) : (
        <>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-display text-[19px] font-semibold tabular-nums text-neutral-900">{formatCurrency(spent)}</span>
              <span className="text-[12.5px] text-neutral-500">de {formatCurrency(limit)}</span>
            </div>
            <ProgressBar value={pct} color={status.color} height={10} gradient={false} />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[12px] text-neutral-500">{pct}% utilizado</span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ color: status.color, background: status.bg }}
              >
                {status.label}
              </span>
            </div>
          </div>
          <p className="text-[12.5px] text-neutral-500">
            {remaining !== undefined && remaining >= 0
              ? <>Ainda pode gastar <strong className="font-semibold text-neutral-700">{formatCurrency(remaining)}</strong></>
              : <>Já ultrapassou em <strong className="font-semibold" style={{ color: 'var(--color-status-critical)' }}>{formatCurrency(Math.abs(remaining ?? 0))}</strong></>}
          </p>
        </>
      )}

      {footer}
    </Card>
  )
}
