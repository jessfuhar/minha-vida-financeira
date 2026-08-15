import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { formatCompactCurrency } from '../../lib/format'
import type { DayOfMonthPoint } from '../../lib/aggregations'

const COLOR_ENTRADAS = 'var(--color-cat-teal)'
const COLOR_SAIDAS = 'var(--color-cat-rose)'

interface MonthCashFlowChartProps {
  data: DayOfMonthPoint[]
  height?: number
}

/** Evolução de Entradas/Saídas ao longo dos dias de UM mês (nunca uma tendência de vários meses) —
 * substitui o antigo gráfico de barras do Fluxo de Caixa, que comparava meses/dias fora do período
 * selecionado na tela. */
export function MonthCashFlowChart({ data, height = 300 }: MonthCashFlowChartProps) {
  // Evita eixo X poluído em meses de 28-31 dias — mostra só ~10 marcações.
  const tickInterval = Math.max(0, Math.ceil(data.length / 10) - 1)

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
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-neutral-200)" />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: 'var(--color-neutral-300)' }}
            tickLine={false}
            interval={tickInterval}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
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
            dataKey="entradas"
            name="Entradas"
            stroke={COLOR_ENTRADAS}
            strokeWidth={2}
            fill={COLOR_ENTRADAS}
            fillOpacity={0.15}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="saidas"
            name="Saídas"
            stroke={COLOR_SAIDAS}
            strokeWidth={2}
            fill={COLOR_SAIDAS}
            fillOpacity={0.15}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
