import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BillStatusPill } from '../components/ui/StatusPill'
import { bills } from '../data/bills'
import { formatCurrency, formatDate, daysUntil } from '../lib/format'
import { Plus } from 'lucide-react'
import type { BillStatus } from '../data/types'

const filters: { id: 'todas' | BillStatus; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'paga', label: 'Pagas' },
  { id: 'vencida', label: 'Vencidas' },
]

export default function BillsToPay() {
  const [active, setActive] = useState<(typeof filters)[number]['id']>('todas')

  const filtered = useMemo(
    () => (active === 'todas' ? bills : bills.filter((b) => b.status === active)),
    [active],
  )

  const totals = useMemo(() => {
    const pendente = bills.filter((b) => b.status === 'pendente').reduce((s, b) => s + b.amount, 0)
    const vencida = bills.filter((b) => b.status === 'vencida').reduce((s, b) => s + b.amount, 0)
    const paga = bills.filter((b) => b.status === 'paga').reduce((s, b) => s + b.amount, 0)
    return { pendente, vencida, paga }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Suas contas fixas e variáveis, com vencimento e status."
        action={
          <Button size="sm">
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
            <p className="text-[13px] text-neutral-500">Pagas no mês</p>
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

        <div className="-mx-0 overflow-x-auto p-5 pt-4 lg:p-6 lg:pt-4">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-neutral-500">Nenhuma conta nesse filtro.</p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="text-[12px] uppercase tracking-wide text-neutral-400">
                  <th className="pb-3 pr-4 font-medium">Conta</th>
                  <th className="pb-3 pr-4 font-medium">Valor</th>
                  <th className="pb-3 pr-4 font-medium">Vencimento</th>
                  <th className="pb-3 pr-4 font-medium">Categoria</th>
                  <th className="pb-3 pr-4 font-medium">Centro de custo</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const days = daysUntil(b.dueDate)
                  return (
                    <tr key={b.id} className="border-t border-[var(--border-hairline)] text-[13.5px]">
                      <td className="py-3 pr-4 font-medium text-neutral-800">{b.name}</td>
                      <td className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums text-neutral-900">
                        {formatCurrency(b.amount)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">
                        {formatDate(b.dueDate)}
                        {b.status === 'pendente' && days <= 3 && days >= 0 && (
                          <span className="ml-2 text-[11.5px] font-medium" style={{ color: 'var(--color-status-serious)' }}>
                            {days === 0 ? 'vence hoje' : `em ${days}d`}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">{b.category}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">{b.costCenter}</td>
                      <td className="py-3">
                        <BillStatusPill status={b.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
