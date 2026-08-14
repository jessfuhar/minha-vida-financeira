import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  // Usado por telas com tabelas grandes (ex.: prévia de importação) que precisam aproveitar
  // praticamente toda a largura/altura da tela — continua um modal (fundo escurecido, cabeçalho e
  // rodapé com a mesma identidade visual), só que muito maior.
  xl: 'w-[95vw] max-w-[1600px]',
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

  const isXl = width === 'xl'

  return (
    <div className={['fixed inset-0 z-50 flex justify-center overflow-y-auto p-4', isXl ? 'items-center' : 'items-start pt-10 lg:pt-16'].join(' ')}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={[
          'relative w-full rounded-2xl border border-[var(--border-hairline)] bg-white shadow-2xl',
          widths[width],
          isXl ? 'flex h-[92vh] max-h-[92vh] flex-col' : '',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[var(--border-hairline)] px-5 py-4 lg:px-6">
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

        <div className={isXl ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-5 lg:px-6' : 'max-h-[70vh] overflow-y-auto px-5 py-5 lg:px-6'}>{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-hairline)] px-5 py-4 lg:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
