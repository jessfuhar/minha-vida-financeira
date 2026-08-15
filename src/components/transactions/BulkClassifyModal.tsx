import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Select } from '../ui/FormField'
import { CostCenterFormModal, type CostCenterFormValues } from '../costcenters/CostCenterFormModal'
import type { Category, CostCenter } from '../../db/models'

/** Mesmo par de sentinelas de TransactionFormModal — só usados dentro do <select>, nunca gravados
 * em `costCenterId`/`categoryId`. */
const NEW_COST_CENTER_OPTION = '__new_cost_center__'
const NEW_CATEGORY_OPTION = '__new_category__'

interface BulkClassifyModalProps {
  open: boolean
  onClose: () => void
  /** 'centroDeCusto' pede só o centro de custo (e limpa a categoria); 'categoria' pede centro de
   * custo + categoria dentro dele. */
  mode: 'categoria' | 'centroDeCusto'
  count: number
  costCenters: CostCenter[]
  onConfirm: (value: { costCenterId: string | null; categoryId: string | null }) => Promise<void>
  /** Opcionais: quando informados, mostram "+ Criar novo..." ao final dos selects (só faz sentido
   * para lançamentos — contas a pagar reaproveitam este mesmo modal sem passar essas props). */
  onCreateCostCenter?: (values: CostCenterFormValues) => Promise<CostCenter>
  onCreateCategory?: (costCenterId: string, name: string) => Promise<Category>
}

export function BulkClassifyModal({
  open,
  onClose,
  mode,
  count,
  costCenters,
  onConfirm,
  onCreateCostCenter,
  onCreateCategory,
}: BulkClassifyModalProps) {
  const [costCenterId, setCostCenterId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [costCenterModalOpen, setCostCenterModalOpen] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (!open) return
    setCostCenterId('')
    setCategoryId('')
    setAddingCategory(false)
    setNewCategoryName('')
  }, [open])

  const selectedCostCenter = costCenters.find((c) => c.id === costCenterId)

  const handleCostCenterChange = (value: string) => {
    if (value === NEW_COST_CENTER_OPTION) {
      setCostCenterModalOpen(true)
      return
    }
    setCostCenterId(value)
    setCategoryId('')
    setAddingCategory(false)
  }

  const handleCreateCostCenter = async (formValues: CostCenterFormValues) => {
    if (!onCreateCostCenter) return
    const created = await onCreateCostCenter(formValues)
    setCostCenterId(created.id)
    setCategoryId('')
  }

  const handleCategoryChange = (value: string) => {
    if (value === NEW_CATEGORY_OPTION) {
      setAddingCategory(true)
      setNewCategoryName('')
      return
    }
    setCategoryId(value)
  }

  const confirmAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name || !costCenterId || !onCreateCategory) {
      setAddingCategory(false)
      return
    }
    const created = await onCreateCategory(costCenterId, name)
    setCategoryId(created.id)
    setNewCategoryName('')
    setAddingCategory(false)
  }

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
    <>
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
            <Select value={costCenterId} onChange={(e) => handleCostCenterChange(e.target.value)}>
              <option value="">Selecione…</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.emoji} {cc.name}
                </option>
              ))}
              {onCreateCostCenter && <option value={NEW_COST_CENTER_OPTION}>+ Criar novo centro de custo</option>}
            </Select>
          </Field>

          {mode === 'categoria' && (
            <Field label="Categoria" hint={selectedCostCenter ? undefined : 'Escolha um centro de custo primeiro'}>
              {addingCategory ? (
                <div className="flex items-center gap-2">
                  <TextInput
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nome da categoria"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void confirmAddCategory()
                      }
                      if (e.key === 'Escape') setAddingCategory(false)
                    }}
                  />
                  <Button type="button" size="sm" onClick={confirmAddCategory} className="shrink-0">
                    Criar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAddingCategory(false)} className="shrink-0">
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)} disabled={!selectedCostCenter}>
                  <option value="">Sem categoria</option>
                  {selectedCostCenter?.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  {selectedCostCenter && onCreateCategory && <option value={NEW_CATEGORY_OPTION}>+ Criar nova categoria</option>}
                </Select>
              )}
            </Field>
          )}
        </div>
      </Modal>
      {onCreateCostCenter && (
        <CostCenterFormModal open={costCenterModalOpen} onClose={() => setCostCenterModalOpen(false)} onSubmit={handleCreateCostCenter} />
      )}
    </>
  )
}
