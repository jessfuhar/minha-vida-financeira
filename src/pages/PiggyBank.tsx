import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Button } from '../components/ui/Button'
import { savingsGoals } from '../data/goals'
import { formatCurrency, formatDateLong } from '../lib/format'
import { Plus, Target } from 'lucide-react'

export default function PiggyBank() {
  const totalSaved = savingsGoals.reduce((s, g) => s + g.saved, 0)
  const totalTarget = savingsGoals.reduce((s, g) => s + g.target, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cofrinho"
        subtitle="Suas metas de economia — guarde um pouco de cada vez até chegar lá."
        action={
          <Button size="sm">
            <Plus size={16} /> Nova meta
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-rose-50 to-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <Target size={20} />
          </div>
          <div>
            <p className="text-[13px] text-neutral-500">Total guardado em todas as metas</p>
            <p className="font-display text-[20px] font-semibold text-neutral-900">{formatCurrency(totalSaved)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-neutral-500">Meta somada</p>
          <p className="text-[15px] font-semibold text-neutral-700">{formatCurrency(totalTarget)}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {savingsGoals.map((goal) => {
          const pct = Math.round((goal.saved / goal.target) * 100)
          return (
            <Card key={goal.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-[19px]"
                  style={{ background: `color-mix(in srgb, ${goal.color} 14%, white)` }}
                >
                  {goal.emoji}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{goal.name}</p>
                  {goal.deadline && (
                    <p className="text-[12px] text-neutral-500">até {formatDateLong(goal.deadline)}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-display text-[19px] font-semibold tabular-nums text-neutral-900">
                    {formatCurrency(goal.saved)}
                  </span>
                  <span className="text-[12.5px] text-neutral-500">de {formatCurrency(goal.target)}</span>
                </div>
                <ProgressBar value={pct} color={goal.color} height={10} />
                <div className="mt-1.5 flex items-center justify-between text-[12px] text-neutral-500">
                  <span>{pct}% concluído</span>
                  <span>+{formatCurrency(goal.monthlyContribution)}/mês</span>
                </div>
              </div>
            </Card>
          )
        })}

        <button
          type="button"
          className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-300 bg-rose-50/40 p-5 text-rose-700 transition-colors hover:bg-rose-50"
        >
          <Plus size={22} />
          <span className="text-[13.5px] font-medium">Criar nova meta</span>
        </button>
      </div>
    </div>
  )
}
