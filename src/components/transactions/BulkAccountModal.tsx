import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account } from '../../db/models'

interface BulkAccountModalProps {
  open: boolean
  onClose: () => void
  count: number
  accounts: Account[]
  onConfirm: (accountId: string) => Promise<void>
}

export function BulkAccountModal({ open, onClose, count, accounts, onConfirm }: BulkAccountModalProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setAccountId(accounts[0]?.id ?? '')
  }, [open, accounts])

  const handleConfirm = async () => {
    if (!accountId) return
    setSaving(true)
    try {
      await onConfirm(accountId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alterar conta em massa"
      subtitle={`Aplicar a ${count} lançamento${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'}.`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || !accountId}>
            {saving ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-status-warning-bg)] px-3.5 py-3 text-[13px]" style={{ color: 'var(--color-status-warning)' }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Mover lançamentos para outra conta afeta o saldo calculado das duas contas envolvidas. Os saldos serão
            recalculados automaticamente após a confirmação.
          </p>
        </div>

        <Field label="Nova conta bancária" required>
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
