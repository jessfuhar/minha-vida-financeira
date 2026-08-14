import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { formatCompactCurrency } from '../../lib/format'

const COLOR = 'var(--color-rose-700)'

interface BalanceEvolutionChartProps {
  data: { month: string; saldo: number }[]
  height?: number
}

export function BalanceEvolutionChart({ data, height = 240 }: BalanceEvolutionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
        <Tooltip cursor={{ stroke: 'var(--color-neutral-300)' }} content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="saldo"
          name="Saldo"
          stroke={COLOR}
          strokeWidth={2}
          fill={COLOR}
          fillOpacity={0.1}
          dot={{ r: 3.5, fill: COLOR, strokeWidth: 2, stroke: 'white' }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
