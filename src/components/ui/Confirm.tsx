import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    setOpts(null)
    resolverRef.current?.(result)
    resolverRef.current = null
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={opts !== null}
        onClose={() => close(false)}
        title={opts?.title ?? ''}
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => close(false)}>
              {opts?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => close(true)}
              className={opts?.danger ? '!bg-[var(--color-status-critical)] hover:!bg-[var(--color-status-critical)]' : ''}
            >
              {opts?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          {opts?.danger && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-status-critical-bg)]">
              <AlertTriangle size={17} style={{ color: 'var(--color-status-critical)' }} />
            </div>
          )}
          <p className="text-[13.5px] leading-relaxed text-neutral-600">{opts?.description}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>')
  return ctx.confirm
}
