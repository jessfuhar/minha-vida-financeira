import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import { formatCompactCurrency } from '../../lib/format'
import type { AnnualCashFlowPoint } from '../../lib/aggregations'

const COLOR_ENTRADAS = 'var(--color-cat-teal)'
const COLOR_SAIDAS = 'var(--color-cat-rose)'

interface AnnualCashFlowChartProps {
  data: AnnualCashFlowPoint[]
  height?: number
  /** Chave do mês (YYYY-MM) destacado — os outros meses ficam com opacidade reduzida. `null`/undefined
   * = nenhum destaque, todos os meses com opacidade plena. */
  selectedKey?: string | null
  /** Clicar numa barra destaca rapidamente aquele mês — visão rápida, não substitui Relatórios. */
  onSelectMonth?: (key: string) => void
}

/** Gráfico rápido Janeiro→Dezembro do ano selecionado, usado no Início — clicar num mês só destaca
 * (nunca altera o período global do Fluxo de Caixa/Centros de Custo/Relatórios). */
export function AnnualCashFlowChart({ data, height = 260, selectedKey, onSelectMonth }: AnnualCashFlowChartProps) {
  const opacityFor = (key: string) => (!selectedKey || selectedKey === key ? 1 : 0.3)
  const handleClick = (_: unknown, index: number) => {
    const point = data[index]
    if (point) onSelectMonth?.(point.key)
  }

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
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barGap={4} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--color-neutral-200)" />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: 'var(--color-neutral-300)' }}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={64}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactCurrency(v)}
          />
          <Tooltip cursor={{ fill: 'var(--color-rose-50)' }} content={<ChartTooltip />} />
          <Bar dataKey="entradas" name="Entradas" radius={[4, 4, 0, 0]} maxBarSize={16} onClick={handleClick} cursor={onSelectMonth ? 'pointer' : undefined}>
            {data.map((d) => (
              <Cell key={d.key} fill={COLOR_ENTRADAS} fillOpacity={opacityFor(d.key)} />
            ))}
          </Bar>
          <Bar dataKey="saidas" name="Saídas" radius={[4, 4, 0, 0]} maxBarSize={16} onClick={handleClick} cursor={onSelectMonth ? 'pointer' : undefined}>
            {data.map((d) => (
              <Cell key={d.key} fill={COLOR_SAIDAS} fillOpacity={opacityFor(d.key)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
