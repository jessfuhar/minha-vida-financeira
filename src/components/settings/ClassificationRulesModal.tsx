import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Select } from '../ui/FormField'
import { EmptyState } from '../ui/EmptyState'
import { useConfirm } from '../ui/Confirm'
import { Zap, Trash2, Power } from 'lucide-react'
import type { ClassificationRule, CostCenter } from '../../db/models'

interface ClassificationRulesModalProps {
  open: boolean
  onClose: () => void
  rules: ClassificationRule[]
  costCenters: CostCenter[]
  onUpdate: (id: string, patch: Partial<Pick<ClassificationRule, 'categoryId' | 'costCenterId' | 'active'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ClassificationRulesModal({ open, onClose, rules, costCenters, onUpdate, onDelete }: ClassificationRulesModalProps) {
  const confirm = useConfirm()
  const [editingId, setEditingId] = useState<string | null>(null)

  const costCenterLabel = (id: string | null) => {
    if (!id) return '—'
    const cc = costCenters.find((c) => c.id === id)
    return cc ? `${cc.emoji} ${cc.name}` : '—'
  }
  const categoryLabel = (costCenterId: string | null, categoryId: string | null) => {
    if (!costCenterId || !categoryId) return '—'
    const cc = costCenters.find((c) => c.id === costCenterId)
    return cc?.categories.find((cat) => cat.id === categoryId)?.name ?? '—'
  }

  const handleDelete = async (rule: ClassificationRule) => {
    const ok = await confirm({
      title: 'Excluir regra',
      description: `Excluir a regra de classificação de "${rule.label}"? Os lançamentos já classificados não são alterados.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await onDelete(rule.id)
  }

  const sorted = [...rules].sort((a, b) => b.useCount - a.useCount || a.label.localeCompare(b.label))

  return (
    <Modal open={open} onClose={onClose} title="Regras de classificação" subtitle="Aprendidas a partir das suas próprias classificações — nunca genéricas por tipo de movimentação." width="lg">
      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma regra ainda"
          description='Toda vez que você classifica manualmente uma movimentação com contraparte identificada (ex.: "COPEL DISTRIBUICAO S.A.") com Centro de Custo, uma regra é aprendida automaticamente e passa a aparecer aqui.'
        />
      ) : (
        <ul className="divide-y divide-[var(--border-hairline)]">
          {sorted.map((rule) => (
            <li key={rule.id} className={['py-3 first:pt-0 last:pb-0', rule.active ? '' : 'opacity-50'].join(' ')}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-neutral-800">{rule.label}</p>
                <span className="shrink-0 text-[11px] text-neutral-400">
                  usada {rule.useCount}x
                </span>
                <button
                  type="button"
                  onClick={() => onUpdate(rule.id, { active: !rule.active })}
                  className={[
                    'shrink-0 rounded-lg p-1.5 transition-colors',
                    rule.active ? 'text-[var(--color-status-good)] hover:bg-[var(--color-status-good-bg)]' : 'text-neutral-400 hover:bg-neutral-100',
                  ].join(' ')}
                  aria-label={rule.active ? 'Desativar regra' : 'Ativar regra'}
                  title={rule.active ? 'Ativa — clique para desativar' : 'Inativa — clique para ativar'}
                >
                  <Power size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule)}
                  className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                  aria-label="Excluir regra"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {editingId === rule.id ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Select
                    value={rule.costCenterId ?? ''}
                    onChange={(e) => onUpdate(rule.id, { costCenterId: e.target.value || null, categoryId: null })}
                  >
                    <option value="">Sem centro de custo</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.emoji} {cc.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={rule.categoryId ?? ''}
                    onChange={(e) => onUpdate(rule.id, { categoryId: e.target.value || null })}
                    disabled={!rule.costCenterId}
                  >
                    <option value="">Sem categoria</option>
                    {costCenters
                      .find((cc) => cc.id === rule.costCenterId)
                      ?.categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </Select>
                  <Button size="sm" variant="ghost" className="col-span-2" onClick={() => setEditingId(null)}>
                    Concluir edição
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(rule.id)}
                  className="mt-1 text-left text-[12.5px] text-neutral-500 hover:text-rose-700 hover:underline"
                >
                  {categoryLabel(rule.costCenterId, rule.categoryId)} · {costCenterLabel(rule.costCenterId)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
