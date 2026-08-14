import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { TopModulesBar } from './TopModulesBar'
import { useData } from '../../context/DataContext'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { loading, persistent } = useData()

  return (
    <div className="flex min-h-screen bg-[var(--surface-page)]">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopModulesBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1180px]">
            {!persistent && !loading && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px]" style={{ background: 'var(--color-status-warning-bg)', color: 'var(--color-status-warning)' }}>
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  Este ambiente não permite salvar dados no navegador — suas alterações vão funcionar normalmente,
                  mas serão perdidas ao recarregar. Abra o arquivo diretamente no navegador para salvar de verdade.
                </span>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-[14px] text-neutral-400">Carregando seus dados…</div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
