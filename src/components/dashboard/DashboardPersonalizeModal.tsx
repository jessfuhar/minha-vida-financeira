import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { DASHBOARD_SECTIONS } from '../../config/dashboardSections'
import { ArrowUp, ArrowDown, Star, RotateCcw } from 'lucide-react'
import type { CostCenter, DashboardLayout } from '../../db/models'

interface DashboardPersonalizeModalProps {
  open: boolean
  onClose: () => void
  layout: DashboardLayout
  costCenters: CostCenter[]
  onUpdateLayout: (patch: Partial<DashboardLayout>) => void
  onToggleFavorite: (costCenterId: string) => void
  onReset: () => void
}

/**
 * Configurações → Personalizar painel — mostrar/ocultar seções, reordenar (setas, sem precisar de
 * drag-and-drop aqui — o modo arrastar-e-soltar fica no próprio painel, em "Organizar painel"),
 * marcar Centros de Custo favoritos e restaurar a organização padrão.
 */
export function DashboardPersonalizeModal({
  open,
  onClose,
  layout,
  costCenters,
  onUpdateLayout,
  onToggleFavorite,
  onReset,
}: DashboardPersonalizeModalProps) {
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= layout.order.length) return
    const next = [...layout.order]
    ;[next[index], next[target]] = [next[target], next[index]]
    onUpdateLayout({ order: next })
  }

  const toggleVisible = (key: DashboardLayout['hidden'][number]) => {
    const isHidden = layout.hidden.includes(key)
    onUpdateLayout({ hidden: isHidden ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key] })
  }

  return (
    <Modal open={open} onClose={onClose} title="Personalizar painel" subtitle="Escolha o que aparece no seu painel inicial e em que ordem." width="lg">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-neutral-500">Seções do painel</p>
          <ul className="divide-y divide-[var(--border-hairline)] rounded-lg border border-[var(--border-hairline)]">
            {layout.order.map((key, index) => {
              const section = DASHBOARD_SECTIONS.find((s) => s.key === key)
              const visible = !layout.hidden.includes(key)
              return (
                <li key={key} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <label className="flex min-w-0 flex-1 items-center gap-2.5">
                    <input type="checkbox" checked={visible} onChange={() => toggleVisible(key)} />
                    <span className={['truncate text-[13.5px]', visible ? 'text-neutral-800' : 'text-neutral-400'].join(' ')}>
                      {section?.label ?? key}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Mover ${section?.label ?? key} para cima`}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === layout.order.length - 1}
                      aria-label={`Mover ${section?.label ?? key} para baixo`}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {costCenters.length > 0 && (
          <div>
            <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-neutral-500">Centros de custo favoritos</p>
            <ul className="divide-y divide-[var(--border-hairline)] rounded-lg border border-[var(--border-hairline)]">
              {costCenters.map((cc) => {
                const isFavorite = layout.favoriteCostCenterIds.includes(cc.id)
                return (
                  <li key={cc.id}>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(cc.id)}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-rose-50/50"
                    >
                      <Star size={15} className={isFavorite ? 'fill-rose-700 text-rose-700' : 'text-neutral-300'} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-neutral-800">
                        {cc.emoji} {cc.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-4">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw size={14} /> Restaurar organização padrão
          </Button>
          <Button size="sm" onClick={onClose}>
            Concluído
          </Button>
        </div>
      </div>
    </Modal>
  )
}
