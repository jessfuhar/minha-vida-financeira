import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Sparkline } from './Sparkline'
import { Card } from './Card'

interface StatTileProps {
  label: string
  value: string
  icon: LucideIcon
  accent: string
  deltaLabel?: string
  deltaDirection?: 'up' | 'down'
  trend?: number[]
}

export function StatTile({ label, value, icon: Icon, accent, deltaLabel, deltaDirection, trend }: StatTileProps) {
  const isUp = deltaDirection === 'up'
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-neutral-500">{label}</p>
          <p className="mt-1.5 font-display text-[24px] font-semibold text-neutral-900 tabular-nums lg:text-[26px]">
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${accent} 14%, white)` }}
        >
          <Icon size={19} style={{ color: accent }} strokeWidth={2} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {deltaLabel ? (
          <span
            className="inline-flex items-center gap-1 text-[12.5px] font-medium"
            style={{ color: isUp ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
          >
            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {deltaLabel}
          </span>
        ) : (
          <span />
        )}
        {trend && <Sparkline data={trend} color={accent} />}
      </div>
    </Card>
  )
}
