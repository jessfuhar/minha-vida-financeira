import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/FormField'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'

interface SpendingLimitModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: number | undefined) => Promise<void> | void
  title: string
  currentValue?: number
  placeholder?: string
}

export function SpendingLimitModal({ open, onClose, onSubmit, title, currentValue, placeholder }: SpendingLimitModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(currentValue !== undefined ? String(currentValue) : '')
    setError('')
  }, [open, currentValue])

  const handleSubmit = async () => {
    if (value.trim() === '') {
      setSaving(true)
      try {
        await onSubmit(undefined)
        onClose()
      } finally {
        setSaving(false)
      }
      return
    }
    if (!isValidCurrencyInput(value) || parseCurrencyInput(value) < 0) {
      return setError('Informe um valor válido.')
    }
    setError('')
    setSaving(true)
    try {
      await onSubmit(parseCurrencyInput(value))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <Field
        label="Limite"
        error={error || undefined}
        hint={isValidCurrencyInput(value) ? formatCurrency(parseCurrencyInput(value)) : 'Deixe em branco para remover o limite'}
      >
        <TextInput
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? '0,00'}
          autoFocus
        />
      </Field>
    </Modal>
  )
}
