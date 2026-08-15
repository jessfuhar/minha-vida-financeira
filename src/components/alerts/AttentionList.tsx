import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { AttentionAlert } from '../../data/types'
import { AlertLevelDot } from '../ui/StatusPill'

// Cada alerta tem destino conhecido — clicar leva direto para a tela que resolve o problema (nunca
// navegação quebrada). IDs vêm de DataContext.alerts.
const ALERT_DESTINATIONS: Record<string, string> = {
  'no-accounts': '/',
  'overdue-bills': '/contas-a-pagar',
  'upcoming-bills': '/contas-a-pagar',
  'uncategorized-tx': '/fluxo-de-caixa',
  'incomplete-bills': '/contas-a-pagar',
}

export function AttentionList({ alerts }: { alerts: AttentionAlert[] }) {
  const navigate = useNavigate()
  return (
    <ul className="divide-y divide-[var(--border-hairline)]">
      {alerts.map((alert) => {
        const destination = ALERT_DESTINATIONS[alert.id]
        return (
          <li key={alert.id}>
            <button
              type="button"
              onClick={destination ? () => navigate(destination) : undefined}
              disabled={!destination}
              className="flex w-full items-center gap-2.5 py-2.5 text-left transition-colors first:pt-0 last:pb-0 disabled:cursor-default enabled:hover:text-rose-700"
            >
              <AlertLevelDot level={alert.level} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-neutral-800">{alert.title}</p>
                {alert.description && <p className="mt-0.5 truncate text-[12px] text-neutral-500">{alert.description}</p>}
              </div>
              {destination && <ChevronRight size={15} className="shrink-0 text-neutral-300" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
