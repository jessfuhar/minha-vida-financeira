import type { ReactNode } from 'react'
import { CheckCircle2, Clock, AlertTriangle, HelpCircle, Circle } from 'lucide-react'
import type { BillStatus, TransactionStatus, AlertLevel } from '../../data/types'

interface PillDef {
  label: string
  bg: string
  fg: string
  icon: ReactNode
}

const billStatusMap: Record<BillStatus, PillDef> = {
  paga: { label: 'Paga', bg: 'var(--color-status-good-bg)', fg: 'var(--color-status-good)', icon: <CheckCircle2 size={13} /> },
  pendente: { label: 'Pendente', bg: 'var(--color-status-warning-bg)', fg: 'var(--color-status-warning)', icon: <Clock size={13} /> },
  vencida: { label: 'Vencida', bg: 'var(--color-status-critical-bg)', fg: 'var(--color-status-critical)', icon: <AlertTriangle size={13} /> },
}

const transactionStatusMap: Record<TransactionStatus, PillDef> = {
  classificado: { label: 'Classificado', bg: 'var(--color-status-good-bg)', fg: 'var(--color-status-good)', icon: <CheckCircle2 size={13} /> },
  conciliado: { label: 'Conciliado', bg: 'var(--color-status-good-bg)', fg: 'var(--color-status-good)', icon: <CheckCircle2 size={13} /> },
  aguardando_classificacao: {
    label: 'Aguardando classificação',
    bg: 'var(--color-status-warning-bg)',
    fg: 'var(--color-status-warning)',
    icon: <HelpCircle size={13} />,
  },
}

const alertLevelMap: Record<AlertLevel, PillDef> = {
  info: { label: 'Informativo', bg: 'var(--color-neutral-100)', fg: 'var(--color-neutral-600)', icon: <Circle size={13} /> },
  atencao: { label: 'Atenção', bg: 'var(--color-status-warning-bg)', fg: 'var(--color-status-warning)', icon: <AlertTriangle size={13} /> },
  urgente: { label: 'Urgente', bg: 'var(--color-status-critical-bg)', fg: 'var(--color-status-critical)', icon: <AlertTriangle size={13} /> },
}

function Pill({ def }: { def: PillDef }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{ background: def.bg, color: def.fg }}
    >
      {def.icon}
      {def.label}
    </span>
  )
}

export function BillStatusPill({ status }: { status: BillStatus }) {
  return <Pill def={billStatusMap[status]} />
}

export function TransactionStatusPill({ status }: { status: TransactionStatus }) {
  return <Pill def={transactionStatusMap[status]} />
}

export function AlertLevelDot({ level }: { level: AlertLevel }) {
  const def = alertLevelMap[level]
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: def.fg }} />
}

export { billStatusMap, transactionStatusMap, alertLevelMap }
