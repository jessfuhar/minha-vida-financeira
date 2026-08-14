import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'lg'
}

export function SearchInput({ size = 'md', className = '', ...rest }: SearchInputProps) {
  const isLg = size === 'lg'
  return (
    <div className="relative w-full">
      <Search
        size={isLg ? 20 : 16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <input
        type="text"
        className={[
          'w-full rounded-2xl border border-[var(--border-hairline)] bg-white text-neutral-800 placeholder:text-neutral-400',
          'focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100',
          isLg ? 'py-4 pl-12 pr-4 text-[16px] shadow-sm' : 'py-2.5 pl-10 pr-3 text-[14px]',
          className,
        ].join(' ')}
        {...rest}
      />
    </div>
  )
}
