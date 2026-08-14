import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
}

export function Card({ children, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-[var(--border-hairline)] bg-white shadow-[0_1px_2px_rgba(42,34,34,0.04)]',
        padded ? 'p-5 lg:p-6' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-[15.5px] font-semibold text-neutral-900">{children}</h2>
      {hint}
    </div>
  )
}
