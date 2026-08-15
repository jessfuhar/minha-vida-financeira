import {
  Home,
  Search,
  Bell,
  User,
  Settings,
  ArrowLeftRight,
  ReceiptText,
  PiggyBank,
  Layers,
  BarChart3,
  Gauge,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: number
}

/** Itens principais da barra lateral. */
export const sidebarItems: NavItem[] = [
  { label: 'Início', path: '/', icon: Home },
  { label: 'Buscar', path: '/buscar', icon: Search },
  { label: 'Notificações', path: '/notificacoes', icon: Bell, badge: 3 },
  { label: 'Perfil', path: '/perfil', icon: User },
]

export const sidebarFooterItem: NavItem = {
  label: 'Configurações',
  path: '/configuracoes',
  icon: Settings,
}

/** Módulos financeiros na barra superior. */
export const topModules: NavItem[] = [
  { label: 'Fluxo de Caixa', path: '/fluxo-de-caixa', icon: ArrowLeftRight },
  { label: 'Receitas', path: '/receitas', icon: TrendingUp },
  { label: 'Contas a Pagar', path: '/contas-a-pagar', icon: ReceiptText },
  { label: 'Cofrinho', path: '/cofrinho', icon: PiggyBank },
  { label: 'Centros de Custo', path: '/centros-de-custo', icon: Layers },
  { label: 'Metas', path: '/metas', icon: Gauge },
  { label: 'Relatórios', path: '/relatorios', icon: BarChart3 },
]
