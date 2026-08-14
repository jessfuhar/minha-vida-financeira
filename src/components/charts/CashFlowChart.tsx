import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { CashFlowSeriesPoint as CashFlowPoint } from '../../lib/aggregations'
import { ChartTooltip } from './ChartTooltip'
import { formatCompactCurrency } from '../../lib/format'

const COLOR_ENTRADAS = 'var(--color-cat-teal)'
const COLOR_SAIDAS = 'var(--color-cat-rose)'
const COLOR_SALDO = 'var(--color-cat-violet)'

interface CashFlowChartProps {
  data: CashFlowPoint[]
  height?: number
}

function LegendRow() {
  const items = [
    { label: 'Entradas', color: COLOR_ENTRADAS, kind: 'bar' as const },
    { label: 'Saídas', color: COLOR_SAIDAS, kind: 'bar' as const },
    { label: 'Saldo acumulado', color: COLOR_SALDO, kind: 'line' as const },
  ]
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[12.5px] text-neutral-600">
          {it.kind === 'bar' ? (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          ) : (
            <span className="h-[2px] w-3.5 rounded-full" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}

export function CashFlowChart({ data, height = 300 }: CashFlowChartProps) {
  return (
    <div>
      <LegendRow />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barGap={4} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--color-neutral-200)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
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
          <Tooltip
            cursor={{ stroke: 'var(--color-neutral-300)', strokeWidth: 1 }}
            content={<ChartTooltip />}
          />
          <Bar dataKey="entradas" name="Entradas" fill={COLOR_ENTRADAS} radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="saidas" name="Saídas" fill={COLOR_SAIDAS} radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Line
            type="monotone"
            dataKey="saldo"
            name="Saldo acumulado"
            stroke={COLOR_SALDO}
            strokeWidth={2}
            dot={{ r: 4, fill: COLOR_SALDO, strokeWidth: 2, stroke: 'white' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
