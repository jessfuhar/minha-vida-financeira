import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Textarea } from '../ui/FormField'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'
import { todayIso } from '../../lib/aggregations'
import type { GoalContribution } from '../../db/models'

export interface GoalContributionFormValues {
  amount: string
  date: string
  note: string
}

function emptyValues(): GoalContributionFormValues {
  return { amount: '', date: todayIso(), note: '' }
}

interface GoalContributionModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: GoalContributionFormValues) => Promise<void>
  onDelete?: () => void
  goalName: string
  contribution?: GoalContribution | null
}

export function GoalContributionModal({ open, onClose, onSubmit, onDelete, goalName, contribution }: GoalContributionModalProps) {
  const [values, setValues] = useState<GoalContributionFormValues>(emptyValues)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (contribution) {
      setValues({ amount: String(contribution.amount), date: contribution.date, note: contribution.note ?? '' })
    } else {
      setValues(emptyValues())
    }
    setError('')
  }, [open, contribution])

  const handleSubmit = async () => {
    if (!isValidCurrencyInput(values.amount) || parseCurrencyInput(values.amount) <= 0) {
      return setError('Informe um valor válido, maior que zero.')
    }
    if (!values.date) return setError('Informe a data do aporte.')
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
      title={contribution ? 'Editar aporte' : '+ Adicionar valor'}
      subtitle={`Cofrinho: ${goalName}`}
      width="sm"
      footer={
        <>
          {contribution && onDelete && (
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
          <Field label="Data" required error={error.includes('data') ? error : undefined}>
            <TextInput type="date" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} />
          </Field>
        </div>

        <Field label="Observação (opcional)">
          <Textarea
            value={values.note}
            onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
            placeholder="Ex.: Sobrou do mês, prêmio, economia da semana…"
          />
        </Field>
      </div>
    </Modal>
  )
}
