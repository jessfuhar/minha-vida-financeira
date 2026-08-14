import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { notifications as seedNotifications } from '../data/notifications'
import { formatRelativeTime } from '../lib/format'
import { HelpCircle, Clock, AlertTriangle, Wallet, PiggyBank as PiggyBankIcon, Check } from 'lucide-react'
import type { NotificationType } from '../data/types'

const typeMeta: Record<NotificationType, { icon: typeof HelpCircle; color: string }> = {
  classificacao: { icon: HelpCircle, color: 'var(--color-status-warning)' },
  vencimento: { icon: Clock, color: 'var(--color-status-warning)' },
  vencida: { icon: AlertTriangle, color: 'var(--color-status-critical)' },
  saldo: { icon: Wallet, color: 'var(--color-cat-blue)' },
  cofrinho: { icon: PiggyBankIcon, color: 'var(--color-cat-rose)' },
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(seedNotifications)
  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} não lidas` : 'Você está em dia.'}
        action={
          unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-rose-700 hover:underline"
            >
              <Check size={15} /> Marcar todas como lidas
            </button>
          )
        }
      />

      <Card padded={false}>
        <ul className="divide-y divide-[var(--border-hairline)]">
          {notifications.map((n) => {
            const meta = typeMeta[n.type]
            const Icon = meta.icon
            return (
              <li
                key={n.id}
                className={['flex items-start gap-3.5 p-5 lg:px-6', !n.read ? 'bg-rose-50/40' : ''].join(' ')}
              >
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${meta.color} 14%, white)` }}
                >
                  <Icon size={16} style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-neutral-800">{n.title}</p>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />}
                  </div>
                  <p className="mt-0.5 text-[13px] text-neutral-500">{n.description}</p>
                  <p className="mt-1.5 text-[12px] text-neutral-400">{formatRelativeTime(n.date)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
