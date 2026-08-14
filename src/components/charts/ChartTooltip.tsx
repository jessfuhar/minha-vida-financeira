import { formatCurrency } from '../../lib/format'

interface TooltipPayloadItem {
  name?: string
  value?: number
  color?: string
  dataKey?: string
}

interface ChartTooltipProps {
  active?: boolean
  label?: string
  payload?: TooltipPayloadItem[]
}

/** Tooltip padrão dos gráficos: valor em destaque, série em segundo plano, chave de cor via traço. */
export function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-white px-3.5 py-2.5 shadow-lg">
      {label && <p className="mb-1.5 text-[11.5px] font-medium text-neutral-400">{label}</p>}
      <div className="space-y-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="text-neutral-500">{item.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-neutral-900">
              {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
