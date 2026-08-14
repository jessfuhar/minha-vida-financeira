import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  children: ReactNode
  label?: string
}

/** Barra de ações em massa, reutilizável em qualquer tabela com seleção múltipla — mostra "N
 * selecionados" e os botões de ação passados como children (categoria, centro de custo, excluir…). */
export function BulkActionBar({ count, onClear, children, label = 'selecionado' }: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-white px-4 py-3 shadow-lg">
      <span className="mr-1 shrink-0 text-[13px] font-semibold text-neutral-800">
        {count} {label}
        {count === 1 ? '' : 's'}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
        aria-label="Limpar seleção"
      >
        <X size={15} />
      </button>
    </div>
  )
}
