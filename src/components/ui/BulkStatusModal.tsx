import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Field, Select } from './FormField'

interface BulkStatusModalProps {
  open: boolean
  onClose: () => void
  count: number
  options: { value: string; label: string }[]
  onConfirm: (value: string) => Promise<void>
}

/** Modal genérico de alteração de status em massa — reutilizado onde já existe um campo de status
 * real (lançamentos: classificado/aguardando; contas a pagar: pendente/paga). */
export function BulkStatusModal({ open, onClose, count, options, onConfirm }: BulkStatusModalProps) {
  const [value, setValue] = useState(options[0]?.value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValue(options[0]?.value ?? '')
  }, [open, options])

  const handleConfirm = async () => {
    if (!value) return
    setSaving(true)
    try {
      await onConfirm(value)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Status em massa"
      subtitle={`Aplicar a ${count} item${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'}.`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || !value}>
            {saving ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </>
      }
    >
      <Field label="Novo status" required>
        <Select value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  )
}
