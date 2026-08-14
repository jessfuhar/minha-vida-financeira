import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/FormField'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'
import type { PlannedItem } from '../../db/models'

export interface PlannedItemFormValues {
  name: string
  quantity: string
  unitValue: string
}

function emptyValues(): PlannedItemFormValues {
  return { name: '', quantity: '1', unitValue: '' }
}

interface PlannedItemFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: PlannedItemFormValues) => Promise<void>
  onDelete?: () => void
  item?: PlannedItem | null
}

export function PlannedItemFormModal({ open, onClose, onSubmit, onDelete, item }: PlannedItemFormModalProps) {
  const [values, setValues] = useState<PlannedItemFormValues>(emptyValues)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setValues({ name: item.name, quantity: String(item.quantity), unitValue: String(item.unitValue) })
    } else {
      setValues(emptyValues())
    }
    setError('')
  }, [open, item])

  const qty = Number(values.quantity.replace(',', '.'))
  const unit = isValidCurrencyInput(values.unitValue) ? parseCurrencyInput(values.unitValue) : 0
  const total = Number.isFinite(qty) ? qty * unit : 0

  const handleSubmit = async () => {
    if (!values.name.trim()) return setError('Descreva o item.')
    if (values.quantity.trim() === '' || Number.isNaN(qty) || qty <= 0) return setError('Informe uma quantidade válida.')
    if (!isValidCurrencyInput(values.unitValue) || parseCurrencyInput(values.unitValue) < 0) {
      return setError('Informe um valor unitário válido.')
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
      title={item ? 'Editar item previsto' : 'Novo item previsto'}
      subtitle="Referência de planejamento — não é um lançamento real."
      width="sm"
      footer={
        <>
          {item && onDelete && (
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
        <Field label="Item" required error={error.includes('item') ? error : undefined}>
          <TextInput
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Ex.: Passagem de ônibus, Doce…"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade" required error={error.includes('quantidade') ? error : undefined}>
            <TextInput
              inputMode="decimal"
              value={values.quantity}
              onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.value }))}
              placeholder="1"
            />
          </Field>
          <Field label="Valor unitário" required error={error.includes('unitário') ? error : undefined}>
            <TextInput
              inputMode="decimal"
              value={values.unitValue}
              onChange={(e) => setValues((v) => ({ ...v, unitValue: e.target.value }))}
              placeholder="0,00"
            />
          </Field>
        </div>

        {total > 0 && <p className="text-[12.5px] text-neutral-500">Total previsto: {formatCurrency(total)}</p>}
      </div>
    </Modal>
  )
}
