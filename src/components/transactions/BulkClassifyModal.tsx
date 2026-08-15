import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select } from '../ui/FormField'
import type { CostCenter } from '../../db/models'

interface BulkClassifyModalProps {
  open: boolean
  onClose: () => void
  /** 'centroDeCusto' pede só o centro de custo (e limpa a categoria); 'categoria' pede centro de
   * custo + categoria dentro dele. */
  mode: 'categoria' | 'centroDeCusto'
  count: number
  costCenters: CostCenter[]
  onConfirm: (value: { costCenterId: string | null; categoryId: string | null }) => Promise<void>
}

export function BulkClassifyModal({ open, onClose, mode, count, costCenters, onConfirm }: BulkClassifyModalProps) {
  const [costCenterId, setCostCenterId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCostCenterId('')
    setCategoryId('')
  }, [open])

  const selectedCostCenter = costCenters.find((c) => c.id === costCenterId)

  const handleConfirm = async () => {
    if (!costCenterId) return
    setSaving(true)
    try {
      await onConfirm({ costCenterId, categoryId: mode === 'categoria' ? categoryId || null : null })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'categoria' ? 'Categoria em massa' : 'Centro de custo em massa'}
      subtitle={`Aplicar a ${count} lançamento${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'}.`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || !costCenterId}>
            {saving ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Centro de custo" required>
          <Select value={costCenterId} onChange={(e) => { setCostCenterId(e.target.value); setCategoryId('') }}>
            <option value="">Selecione…</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.emoji} {cc.name}
              </option>
            ))}
          </Select>
        </Field>

        {mode === 'categoria' && (
          <Field label="Categoria" hint={selectedCostCenter ? undefined : 'Escolha um centro de custo primeiro'}>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!selectedCostCenter}>
              <option value="">Sem categoria</option>
              {selectedCostCenter?.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}
