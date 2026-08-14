import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { formatCurrency, formatDate } from '../../lib/format'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { GoalContribution } from '../../db/models'

interface GoalHistoryModalProps {
  open: boolean
  onClose: () => void
  goalName: string
  contributions: GoalContribution[]
  onAdd: () => void
  onEdit: (contribution: GoalContribution) => void
  onDelete: (contribution: GoalContribution) => void
}

export function GoalHistoryModal({ open, onClose, goalName, contributions, onAdd, onEdit, onDelete }: GoalHistoryModalProps) {
  const sorted = [...contributions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)))
  const total = contributions.reduce((s, c) => s + c.amount, 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Histórico de aportes"
      subtitle={`Cofrinho: ${goalName}`}
      width="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus size={15} /> Adicionar valor
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-rose-50/60 px-4 py-3">
          <span className="text-[13px] text-neutral-600">Total reservado</span>
          <span className="font-display text-[16px] font-semibold text-neutral-900">{formatCurrency(total)}</span>
        </div>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-neutral-500">Nenhum aporte registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-hairline)]">
            {sorted.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] text-neutral-500">{formatDate(c.date)}</span>
                    <span
                      className="font-display text-[14.5px] font-semibold tabular-nums"
                      style={{ color: c.amount >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
                    >
                      {c.amount >= 0 ? '+' : ''}
                      {formatCurrency(c.amount)}
                    </span>
                  </div>
                  {c.note && <p className="mt-0.5 truncate text-[12px] text-neutral-500">{c.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-rose-700"
                    aria-label="Editar aporte"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c)}
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                    aria-label="Excluir aporte"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
