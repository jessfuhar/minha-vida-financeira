import { NavLink } from 'react-router-dom'
import { sidebarItems, sidebarFooterItem } from '../../config/navigation'
import { brand, greeting } from '../../config/brand'
import { X } from 'lucide-react'

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

function NavRow({ item, onClick }: { item: (typeof sidebarItems)[number]; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      end={item.path === '/'}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium transition-colors',
          isActive
            ? 'bg-rose-100/80 text-rose-900'
            : 'text-neutral-700 hover:bg-rose-50 hover:text-rose-800',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            strokeWidth={2}
            className={isActive ? 'text-rose-700' : 'text-neutral-400 group-hover:text-rose-500'}
          />
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const content = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-7">
        <div className="flex items-center justify-between">
          <p className="font-display text-[17px] font-semibold text-neutral-900">{greeting()}</p>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-neutral-500">{brand.appName}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {sidebarItems.map((item) => (
          <NavRow key={item.path} item={item} onClick={onClose} />
        ))}
      </nav>

      <div className="border-t border-[var(--border-hairline)] px-3 py-4">
        <NavRow item={sidebarFooterItem} onClick={onClose} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: fixa à esquerda */}
      <aside className="hidden w-[248px] shrink-0 border-r border-[var(--border-hairline)] bg-white lg:block">
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {/* Mobile: gaveta sobreposta */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/25" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-[270px] bg-white shadow-xl">{content}</aside>
        </div>
      )}
    </>
  )
}
