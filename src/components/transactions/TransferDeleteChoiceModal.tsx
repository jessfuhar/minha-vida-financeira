import { AlertTriangle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Transaction } from '../../db/models'

interface TransferDeleteChoiceModalProps {
  open: boolean
  onClose: () => void
  transaction: Transaction | null
  onDeleteBoth: () => void
  onUnlinkAndDeleteOne: () => void
}

/** Excluir uma ponta de transferência vinculada precisa de uma escolha explícita — nunca deixa o
 * vínculo quebrado silenciosamente. */
export function TransferDeleteChoiceModal({ open, onClose, transaction, onDeleteBoth, onUnlinkAndDeleteOne }: TransferDeleteChoiceModalProps) {
  if (!transaction) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excluir transferência"
      width="sm"
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-warning-bg)]">
            <AlertTriangle size={17} style={{ color: 'var(--color-status-warning)' }} />
          </div>
          <p className="text-[13.5px] leading-relaxed text-neutral-600">
            Este lançamento faz parte de uma transferência entre contas. Como você quer prosseguir?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            className="!bg-[var(--color-status-critical)] hover:!bg-[var(--color-status-critical)]"
            onClick={onDeleteBoth}
          >
            Excluir as duas movimentações
          </Button>
          <Button variant="secondary" size="sm" onClick={onUnlinkAndDeleteOne}>
            Desvincular e excluir somente esta
          </Button>
        </div>
      </div>
    </Modal>
  )
}
