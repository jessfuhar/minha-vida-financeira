import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Select } from '../ui/FormField'
import { accountTypeLabel } from './AccountCard'
import type { Account, AccountType } from '../../db/models'
import { todayIso } from '../../lib/aggregations'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'

export interface AccountFormValues {
  bank: string
  nickname: string
  type: AccountType
  openingBalance: string
  openingDate: string
}

const emptyValues: AccountFormValues = {
  bank: '',
  nickname: '',
  type: 'corrente',
  openingBalance: '',
  openingDate: todayIso(),
}

interface AccountFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: AccountFormValues) => Promise<void>
  onDelete?: () => void
  account?: Account | null
}

export function AccountFormModal({ open, onClose, onSubmit, onDelete, account }: AccountFormModalProps) {
  const [values, setValues] = useState<AccountFormValues>(emptyValues)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (account) {
      setValues({
        bank: account.bank,
        nickname: account.nickname ?? '',
        type: account.type,
        openingBalance: String(account.openingBalance),
        openingDate: account.openingDate,
      })
    } else {
      setValues(emptyValues)
    }
    setError('')
  }, [open, account])

  const handleSubmit = async () => {
    if (!values.bank.trim()) {
      setError('Informe o nome do banco/instituição.')
      return
    }
    if (!isValidCurrencyInput(values.openingBalance)) {
      setError('Informe um saldo inicial válido.')
      return
    }
    setSaving(true)
    try {
      await onSubmit(values)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Editar conta' : 'Nova conta'}
      subtitle="O saldo atual é calculado automaticamente a partir do saldo inicial e dos lançamentos."
      footer={
        <>
          {account && onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="mr-auto !text-[var(--color-status-critical)]">
              Excluir conta
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Banco / instituição" required error={error && !values.bank.trim() ? error : undefined}>
          <TextInput
            value={values.bank}
            onChange={(e) => setValues((v) => ({ ...v, bank: e.target.value }))}
            placeholder="Ex.: Banco do Brasil, Nubank, Mercado Pago…"
            autoFocus
          />
        </Field>

        <Field label="Apelido (opcional)">
          <TextInput
            value={values.nickname}
            onChange={(e) => setValues((v) => ({ ...v, nickname: e.target.value }))}
            placeholder="Ex.: Conta do dia a dia"
          />
        </Field>

        <Field label="Tipo de conta" required>
          <Select value={values.type} onChange={(e) => setValues((v) => ({ ...v, type: e.target.value as AccountType }))}>
            {Object.entries(accountTypeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Saldo inicial"
            required
            error={error && !isValidCurrencyInput(values.openingBalance) ? error : undefined}
            hint={isValidCurrencyInput(values.openingBalance) ? formatCurrency(parseCurrencyInput(values.openingBalance)) : undefined}
          >
            <TextInput
              inputMode="decimal"
              value={values.openingBalance}
              onChange={(e) => setValues((v) => ({ ...v, openingBalance: e.target.value }))}
              placeholder="Ex.: 39996,65 ou 39.996,65"
            />
          </Field>
          <Field label="Data de referência" required>
            <TextInput
              type="date"
              value={values.openingDate}
              onChange={(e) => setValues((v) => ({ ...v, openingDate: e.target.value }))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
