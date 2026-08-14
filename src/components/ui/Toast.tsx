import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const kindMeta: Record<ToastKind, { icon: typeof CheckCircle2; bg: string; fg: string }> = {
  success: { icon: CheckCircle2, bg: 'var(--color-status-good-bg)', fg: 'var(--color-status-good)' },
  error: { icon: AlertTriangle, bg: 'var(--color-status-critical-bg)', fg: 'var(--color-status-critical)' },
  info: { icon: Info, bg: 'var(--color-neutral-100)', fg: 'var(--color-neutral-600)' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const meta = kindMeta[t.kind]
          const Icon = meta.icon
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-white px-4 py-3 shadow-lg"
            >
              <div
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: meta.bg }}
              >
                <Icon size={13} style={{ color: meta.fg }} />
              </div>
              <p className="flex-1 text-[13.5px] text-neutral-700">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="mt-0.5 text-neutral-300 hover:text-neutral-500"
                aria-label="Fechar aviso"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
