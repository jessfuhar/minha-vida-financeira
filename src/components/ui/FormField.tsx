import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, required, error, hint, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[12px] text-neutral-400">{hint}</p>}
      {error && (
        <p className="mt-1 text-[12px] font-medium" style={{ color: 'var(--color-status-critical)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

const baseInput =
  'w-full rounded-xl border border-[var(--border-hairline)] bg-white px-3.5 py-2.5 text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:bg-neutral-50 disabled:text-neutral-400'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={[baseInput, className].join(' ')} {...rest} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea className={[baseInput, 'resize-none', className].join(' ')} rows={3} {...rest} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select className={[baseInput, 'appearance-none bg-no-repeat pr-9', className].join(' ')} {...rest} style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a79d99' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
      backgroundPosition: 'right 12px center',
    }}>
      {children}
    </select>
  )
}

interface PillToggleOption<T extends string> {
  value: T
  label: string
}

export function PillToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: PillToggleOption<T>[]
}) {
  return (
    <div className="flex rounded-xl bg-[var(--color-neutral-100)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
            value === opt.value ? 'bg-white text-rose-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
