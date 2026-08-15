import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { topModules } from '../../config/navigation'

interface TopModulesBarProps {
  onOpenMenu: () => void
}

export function TopModulesBar({ onOpenMenu }: TopModulesBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-white/85 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-2.5 lg:px-8">
        <button
          onClick={onOpenMenu}
          className="mr-1 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <nav className="scrollbar-none flex flex-1 items-center gap-1 overflow-x-auto">
          {topModules.map((mod) => {
            const Icon = mod.icon
            return (
              <NavLink
                key={mod.path}
                to={mod.path}
                className={({ isActive }) =>
                  [
                    'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-200',
                    isActive
                      ? 'bg-rose-700 text-white shadow-sm shadow-rose-200'
                      : 'text-neutral-600 hover:bg-rose-50 hover:text-rose-800',
                  ].join(' ')
                }
              >
                <Icon size={16} strokeWidth={2} />
                <span className="whitespace-nowrap">{mod.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
