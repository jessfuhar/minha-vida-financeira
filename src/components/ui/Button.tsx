import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'dashed'
  size?: 'sm' | 'md'
}

const variants: Record<string, string> = {
  primary: 'bg-rose-700 text-white hover:bg-rose-800 shadow-sm shadow-rose-200',
  secondary: 'bg-rose-50 text-rose-800 hover:bg-rose-100',
  ghost: 'text-neutral-600 hover:bg-neutral-100',
  dashed: 'border border-dashed border-rose-300 text-rose-700 hover:bg-rose-50 bg-transparent',
}

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2.5 text-[14px]',
}

export function Button({ children, variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
