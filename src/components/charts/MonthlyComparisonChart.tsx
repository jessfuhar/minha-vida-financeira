import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { formatCompactCurrency } from '../../lib/format'

const COLOR_ENTRADAS = 'var(--color-cat-teal)'
const COLOR_SAIDAS = 'var(--color-cat-rose)'

interface MonthlyComparisonChartProps {
  data: { month: string; entradas: number; saidas: number }[]
  height?: number
}

export function MonthlyComparisonChart({ data, height = 260 }: MonthlyComparisonChartProps) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-5">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-neutral-600">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_ENTRADAS }} />
          Entradas
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-neutral-600">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_SAIDAS }} />
          Saídas
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barGap={4} barCategoryGap="34%">
          <CartesianGrid vertical={false} stroke="var(--color-neutral-200)" />
          <XAxis
            dataKey="month"
            axisLine={{ stroke: 'var(--color-neutral-300)' }}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={64}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactCurrency(v)}
          />
          <Tooltip cursor={{ fill: 'var(--color-rose-50)' }} content={<ChartTooltip />} />
          <Bar dataKey="entradas" name="Entradas" fill={COLOR_ENTRADAS} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="saidas" name="Saídas" fill={COLOR_SAIDAS} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
