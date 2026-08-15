import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/format'
import type { CostCenterSpendShare } from '../../lib/aggregations'

interface CostCenterDonutTooltipProps {
  active?: boolean
  payload?: { payload?: CostCenterSpendShare }[]
}

function DonutTooltip({ active, payload }: CostCenterDonutTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-[13px] font-medium text-neutral-800">
        {row.emoji} {row.name}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-neutral-900">
        {formatCurrency(row.total)} · {row.pct.toFixed(0)}%
      </p>
    </div>
  )
}

interface CostCenterDonutChartProps {
  data: CostCenterSpendShare[]
  height?: number
}

/** Distribuição das SAÍDAS entre Centros de Custo num mês — nunca Entradas, para não distorcer a
 * leitura de "para onde foi o dinheiro". Doughnut (não pizza cheia) para deixar espaço ao total no
 * centro, mantendo a mesma cor já usada para cada Centro de Custo no resto do app (`cc.color`). */
export function CostCenterDonutChart({ data, height = 240 }: CostCenterDonutChartProps) {
  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_1fr]">
      <div className="relative mx-auto" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.costCenterId} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-neutral-400">Total</span>
          <span className="text-[15px] font-semibold tabular-nums text-neutral-800">{formatCurrency(total)}</span>
        </div>
      </div>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.costCenterId} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-neutral-700">
              {d.emoji} {d.name}
            </span>
            <span className="shrink-0 tabular-nums text-neutral-500">{d.pct.toFixed(0)}%</span>
            <span className="w-[92px] shrink-0 text-right font-medium tabular-nums text-neutral-800">{formatCurrency(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
