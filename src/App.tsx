import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './context/DataContext'
import { PeriodProvider } from './context/PeriodContext'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/Confirm'
import { AppShell } from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import CashFlow from './pages/CashFlow'
import BillsToPay from './pages/BillsToPay'
import PiggyBank from './pages/PiggyBank'
import CostCenters from './pages/CostCenters'
import SpendingGoals from './pages/SpendingGoals'
import Reports from './pages/Reports'
import Search from './pages/Search'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

// MemoryRouter é usado propositalmente: a navegação fica só em memória, sem
// tocar em window.location/URL — assim o app não quebra ao ser aberto como
// arquivo local, dentro de um iframe de preview com origem restrita, ou em
// qualquer outro contexto sandboxed. O comportamento de clicar nos menus e
// navegar entre as telas continua idêntico.
function App() {
  return (
    <DataProvider>
      <PeriodProvider>
        <ToastProvider>
          <ConfirmProvider>
            <MemoryRouter initialEntries={['/']}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/fluxo-de-caixa" element={<CashFlow />} />
                  <Route path="/contas-a-pagar" element={<BillsToPay />} />
                  <Route path="/cofrinho" element={<PiggyBank />} />
                  <Route path="/centros-de-custo" element={<CostCenters />} />
                  <Route path="/metas" element={<SpendingGoals />} />
                  <Route path="/relatorios" element={<Reports />} />
                  <Route path="/buscar" element={<Search />} />
                  <Route path="/notificacoes" element={<Notifications />} />
                  <Route path="/perfil" element={<Profile />} />
                  <Route path="/configuracoes" element={<Settings />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ToastProvider>
      </PeriodProvider>
    </DataProvider>
  )
}

export default App
