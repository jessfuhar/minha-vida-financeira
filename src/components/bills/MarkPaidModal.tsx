import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account, Bill } from '../../db/models'
import { formatCurrency } from '../../lib/format'

interface MarkPaidModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (opts: { createTransaction: boolean; accountId?: string }) => Promise<void>
  bill: Bill | null
  accounts: Account[]
}

export function MarkPaidModal({ open, onClose, onConfirm, bill, accounts }: MarkPaidModalProps) {
  const [createTransaction, setCreateTransaction] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !bill) return
    setCreateTransaction(true)
    setAccountId(bill.accountId ?? accounts[0]?.id ?? '')
  }, [open, bill, accounts])

  if (!bill) return null

  const alreadyLinked = Boolean(bill.transactionId)

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm({ createTransaction: createTransaction && !alreadyLinked, accountId: accountId || undefined })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Marcar como paga"
      subtitle={`${bill.name} · ${formatCurrency(bill.amount)}`}
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || (createTransaction && !alreadyLinked && !accountId)}>
            {saving ? 'Salvando…' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {alreadyLinked ? (
          <p className="text-[13.5px] text-neutral-600">
            Esta conta já tem um lançamento correspondente no Fluxo de Caixa — apenas o status será atualizado.
          </p>
        ) : (
          <>
            <label className="flex items-start gap-2.5 text-[13.5px] text-neutral-700">
              <input
                type="checkbox"
                checked={createTransaction}
                onChange={(e) => setCreateTransaction(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-rose-600 focus:ring-rose-300"
              />
              <span>Gerar automaticamente o lançamento de saída correspondente no Fluxo de Caixa.</span>
            </label>

            {createTransaction && (
              <Field label="Debitar da conta" required>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Selecione uma conta</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
