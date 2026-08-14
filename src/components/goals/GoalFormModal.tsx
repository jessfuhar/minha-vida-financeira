import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'
import type { Account, Goal } from '../../db/models'

export interface GoalFormValues {
  name: string
  emoji: string
  target: string
  sourceAccountId: string
  deadline: string
}

function emptyValues(): GoalFormValues {
  return { name: '', emoji: '🎯', target: '', sourceAccountId: '', deadline: '' }
}

interface GoalFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: GoalFormValues) => Promise<void>
  onDelete?: () => void
  accounts: Account[]
  goal?: Goal | null
}

export function GoalFormModal({ open, onClose, onSubmit, onDelete, accounts, goal }: GoalFormModalProps) {
  const [values, setValues] = useState<GoalFormValues>(emptyValues)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (goal) {
      setValues({
        name: goal.name,
        emoji: goal.emoji,
        target: String(goal.target),
        sourceAccountId: goal.sourceAccountId ?? '',
        deadline: goal.deadline ?? '',
      })
    } else {
      setValues(emptyValues())
    }
    setError('')
  }, [open, goal])

  const handleSubmit = async () => {
    if (!values.name.trim()) return setError('Dê um nome para a meta.')
    if (!isValidCurrencyInput(values.target) || parseCurrencyInput(values.target) <= 0) {
      return setError('Informe um valor de meta válido.')
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Editar meta' : 'Nova meta'}
      subtitle={
        goal
          ? 'O valor reservado é a soma dos aportes — use "+ Adicionar valor" no card da meta para movimentar.'
          : 'Depois de criar, use "+ Adicionar valor" no card da meta para começar a guardar.'
      }
      footer={
        <>
          {goal && onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="mr-auto !text-[var(--color-status-critical)]">
              Excluir
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
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <Field label="Ícone">
            <TextInput
              value={values.emoji}
              onChange={(e) => setValues((v) => ({ ...v, emoji: e.target.value }))}
              className="text-center text-[18px]"
              maxLength={2}
            />
          </Field>
          <Field label="Nome da meta" required error={error.includes('nome') ? error : undefined}>
            <TextInput
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="Ex.: Viagem, Reserva de emergência…"
              autoFocus
            />
          </Field>
        </div>

        <Field
          label="Valor da meta"
          required
          error={error.includes('meta válido') ? error : undefined}
          hint={isValidCurrencyInput(values.target) ? formatCurrency(parseCurrencyInput(values.target)) : undefined}
        >
          <TextInput
            inputMode="decimal"
            value={values.target}
            onChange={(e) => setValues((v) => ({ ...v, target: e.target.value }))}
            placeholder="0,00"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Conta de origem (opcional)">
            <Select value={values.sourceAccountId} onChange={(e) => setValues((v) => ({ ...v, sourceAccountId: e.target.value }))}>
              <option value="">Nenhuma</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prazo (opcional)">
            <TextInput type="date" value={values.deadline} onChange={(e) => setValues((v) => ({ ...v, deadline: e.target.value }))} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
