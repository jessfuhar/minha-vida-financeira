import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { costCenters } from '../data/costCenters'
import { formatCurrency } from '../lib/format'
import { Info, Plus } from 'lucide-react'

export default function CostCenters() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Centros de Custo"
        subtitle="As grandes áreas da sua vida financeira — cada uma reúne várias categorias de gasto."
        action={
          <Button size="sm">
            <Plus size={16} /> Novo centro de custo
          </Button>
        }
      />

      <Card className="flex items-start gap-3 bg-rose-50/60">
        <Info size={18} className="mt-0.5 shrink-0 text-rose-700" />
        <p className="text-[13.5px] leading-relaxed text-neutral-700">
          <strong className="font-semibold">Centro de custo</strong> não é a mesma coisa que{' '}
          <strong className="font-semibold">categoria</strong>. O centro de custo representa a área geral (ex.: Casa),
          enquanto a categoria representa o tipo específico de gasto dentro dela (ex.: Energia, Internet, Alimentação).
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {costCenters.map((cc) => (
          <Card key={cc.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-[19px]"
                  style={{ background: `color-mix(in srgb, ${cc.color} 14%, white)` }}
                >
                  {cc.emoji}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-neutral-900">{cc.name}</p>
                  <p className="text-[12px] text-neutral-500">{cc.categories.length} categorias</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-neutral-500">este mês</p>
                <p className="text-[14.5px] font-semibold tabular-nums text-neutral-900">
                  {formatCurrency(cc.monthlySpend)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cc.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full px-2.5 py-1 text-[12px] font-medium text-neutral-600"
                  style={{ background: 'var(--color-neutral-100)' }}
                >
                  {cat}
                </span>
              ))}
              <button
                type="button"
                className="rounded-full border border-dashed border-rose-300 px-2.5 py-1 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
              >
                + categoria
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
