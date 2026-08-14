import { useState } from 'react'
import { Pencil, X, Check } from 'lucide-react'
import type { Category } from '../../db/models'

interface CategoryChipProps {
  category: Category
  onRename: (name: string) => void
  onDelete: () => void
  onOpenDetail?: () => void
}

export function CategoryChip({ category, onRename, onDelete, onOpenDetail }: CategoryChipProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(category.name)

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-1 ring-1 ring-rose-200">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              onRename(value.trim())
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setValue(category.name)
              setEditing(false)
            }
          }}
          className="w-24 border-none bg-transparent text-[12px] text-neutral-700 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (value.trim()) {
              onRename(value.trim())
              setEditing(false)
            }
          }}
          className="rounded-full p-0.5 text-[var(--color-status-good)] hover:bg-[var(--color-status-good-bg)]"
          aria-label="Confirmar"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(category.name)
            setEditing(false)
          }}
          className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-100"
          aria-label="Cancelar"
        >
          <X size={12} />
        </button>
      </span>
    )
  }

  return (
    <span
      className="group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-neutral-600"
      style={{ background: 'var(--color-neutral-100)' }}
    >
      {onOpenDetail ? (
        <button
          type="button"
          onClick={onOpenDetail}
          className="hover:text-rose-700 hover:underline"
          aria-label={`Ver detalhes de ${category.name}`}
        >
          {category.name}
        </button>
      ) : (
        category.name
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-full p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-rose-700 group-hover:opacity-100"
        aria-label={`Renomear ${category.name}`}
      >
        <Pencil size={11} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-[var(--color-status-critical)] group-hover:opacity-100"
        aria-label={`Excluir ${category.name}`}
      >
        <X size={11} />
      </button>
    </span>
  )
}
