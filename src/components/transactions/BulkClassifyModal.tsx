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
  /** Quando informado, mostra a opção "Salvar como regra" (só faz sentido para lançamentos, que
   * têm contraparte — contas a pagar não mostram essa opção). */
  ruleGroupsCount?: number
  onConfirm: (value: { costCenterId: string | null; categoryId: string | null }, saveAsRule: boolean) => Promise<void>
}

export function BulkClassifyModal({ open, onClose, mode, count, costCenters, ruleGroupsCount, onConfirm }: BulkClassifyModalProps) {
  const [costCenterId, setCostCenterId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saveAsRule, setSaveAsRule] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCostCenterId('')
    setCategoryId('')
    setSaveAsRule(false)
  }, [open])

  const selectedCostCenter = costCenters.find((c) => c.id === costCenterId)

  const handleConfirm = async () => {
    if (!costCenterId) return
    setSaving(true)
    try {
      await onConfirm(
        { costCenterId, categoryId: mode === 'categoria' ? categoryId || null : null },
        saveAsRule,
      )
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

        {ruleGroupsCount !== undefined && ruleGroupsCount > 0 && (
          <label className="flex items-start gap-2.5 rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-3 text-[13px] text-neutral-600">
            <input
              type="checkbox"
              checked={saveAsRule}
              onChange={(e) => setSaveAsRule(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Salvar como regra para movimentações semelhantes ({ruleGroupsCount} contrapart{ruleGroupsCount === 1 ? 'e' : 'es'} identificada
              {ruleGroupsCount === 1 ? '' : 's'} na seleção). A próxima importação vai sugerir automaticamente essa classificação.
            </span>
          </label>
        )}
      </div>
    </Modal>
  )
}
