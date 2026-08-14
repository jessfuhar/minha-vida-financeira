import type { AttentionAlert } from '../../data/types'
import { AlertLevelDot, alertLevelMap } from '../ui/StatusPill'

export function AttentionList({ alerts }: { alerts: AttentionAlert[] }) {
  return (
    <ul className="divide-y divide-[var(--border-hairline)]">
      {alerts.map((alert) => {
        const def = alertLevelMap[alert.level]
        return (
          <li key={alert.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-1.5">
              <AlertLevelDot level={alert.level} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-neutral-800">{alert.title}</p>
              {alert.description && <p className="mt-0.5 text-[12.5px] text-neutral-500">{alert.description}</p>}
            </div>
            <span
              className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: def.bg, color: def.fg }}
            >
              {def.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
