import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[22px] font-semibold text-neutral-900 lg:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
