import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput } from '../ui/FormField'
import type { CostCenter } from '../../db/models'

export interface CostCenterFormValues {
  name: string
  emoji: string
}

const emptyValues: CostCenterFormValues = { name: '', emoji: '🏷️' }

interface CostCenterFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: CostCenterFormValues) => Promise<void>
  onDelete?: () => void
  costCenter?: CostCenter | null
}

export function CostCenterFormModal({ open, onClose, onSubmit, onDelete, costCenter }: CostCenterFormModalProps) {
  const [values, setValues] = useState<CostCenterFormValues>(emptyValues)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(costCenter ? { name: costCenter.name, emoji: costCenter.emoji } : emptyValues)
    setError('')
  }, [open, costCenter])

  const handleSubmit = async () => {
    if (!values.name.trim()) return setError('Dê um nome para o centro de custo.')
    setSaving(true)
    try {
      await onSubmit({ name: values.name.trim(), emoji: values.emoji.trim() || '🏷️' })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={costCenter ? 'Editar centro de custo' : 'Novo centro de custo'}
      width="sm"
      footer={
        <>
          {costCenter && onDelete && (
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
          <Field label="Nome" required error={error || undefined}>
            <TextInput
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="Ex.: Casa, Pessoal, Trabalho…"
              autoFocus
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
