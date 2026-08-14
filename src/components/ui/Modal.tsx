import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const widths: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10 lg:pt-16">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={[
          'relative w-full rounded-2xl border border-[var(--border-hairline)] bg-white shadow-2xl',
          widths[width],
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-start justify-between border-b border-[var(--border-hairline)] px-5 py-4 lg:px-6">
          <div>
            <h2 id="modal-title" className="font-display text-[16.5px] font-semibold text-neutral-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-neutral-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 lg:px-6">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-hairline)] px-5 py-4 lg:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
