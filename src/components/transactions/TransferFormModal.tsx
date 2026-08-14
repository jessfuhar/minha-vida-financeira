import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Textarea, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account } from '../../db/models'
import { todayIso } from '../../lib/aggregations'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'

export interface TransferFormValues {
  fromAccountId: string
  toAccountId: string
  amount: string
  date: string
  note: string
}

function emptyValues(accounts: Account[]): TransferFormValues {
  return {
    fromAccountId: accounts[0]?.id ?? '',
    toAccountId: accounts[1]?.id ?? accounts[0]?.id ?? '',
    amount: '',
    date: todayIso(),
    note: '',
  }
}

interface TransferFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: TransferFormValues) => Promise<void>
  accounts: Account[]
}

/** Transferência entre contas próprias — cria as duas pontas (saída na origem, entrada no
 * destino) de uma vez, ligadas entre si. Não é receita nem despesa real. */
export function TransferFormModal({ open, onClose, onSubmit, accounts }: TransferFormModalProps) {
  const [values, setValues] = useState<TransferFormValues>(() => emptyValues(accounts))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(emptyValues(accounts))
    setError('')
  }, [open, accounts])

  const handleSubmit = async () => {
    if (!values.fromAccountId || !values.toAccountId) return setError('Selecione as duas contas.')
    if (values.fromAccountId === values.toAccountId) return setError('A conta de origem e destino não podem ser iguais.')
    if (!isValidCurrencyInput(values.amount) || parseCurrencyInput(values.amount) <= 0) {
      return setError('Informe um valor válido, maior que zero.')
    }
    setError('')
    setSaving(true)
    try {
      await onSubmit(values)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const noAccounts = accounts.length < 2

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transferência entre minhas contas"
      subtitle="Não é receita nem despesa real — o dinheiro só muda de conta."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || noAccounts}>
            {saving ? 'Salvando…' : 'Transferir'}
          </Button>
        </>
      }
    >
      {noAccounts ? (
        <p className="py-6 text-center text-[13.5px] text-neutral-500">
          Cadastre pelo menos duas contas bancárias para registrar uma transferência entre elas.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Conta de origem" required error={error.includes('origem') || error.includes('iguais') ? error : undefined}>
              <Select value={values.fromAccountId} onChange={(e) => setValues((v) => ({ ...v, fromAccountId: e.target.value }))}>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Conta de destino" required>
              <Select value={values.toAccountId} onChange={(e) => setValues((v) => ({ ...v, toAccountId: e.target.value }))}>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor"
              required
              error={error.includes('valor') ? error : undefined}
              hint={isValidCurrencyInput(values.amount) ? formatCurrency(parseCurrencyInput(values.amount)) : undefined}
            >
              <TextInput
                inputMode="decimal"
                value={values.amount}
                onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
                placeholder="0,00"
                autoFocus
              />
            </Field>
            <Field label="Data" required>
              <TextInput type="date" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} />
            </Field>
          </div>

          <Field label="Observação (opcional)">
            <Textarea
              value={values.note}
              onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
              placeholder="Alguma anotação sobre essa transferência…"
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}
