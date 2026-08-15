import type { DashboardSectionKey } from '../db/models'

/** Metadados das seções personalizáveis do painel inicial — usado tanto pelo modal de
 * personalização quanto pelo próprio Dashboard para renderizar dinamicamente na ordem escolhida. */
export const DASHBOARD_SECTIONS: { key: DashboardSectionKey; label: string }[] = [
  { key: 'stats', label: 'Resumo financeiro (saldo, entradas, saídas, resultado)' },
  { key: 'accounts', label: 'Minhas contas' },
  { key: 'cashflow', label: 'Fluxo de caixa' },
  { key: 'attention', label: 'Precisa de atenção' },
  { key: 'goal', label: 'Meta do mês' },
  { key: 'favoriteCostCenters', label: 'Centros de custo favoritos' },
  { key: 'recentTransactions', label: 'Últimos lançamentos' },
]

export function dashboardSectionLabel(key: DashboardSectionKey): string {
  return DASHBOARD_SECTIONS.find((s) => s.key === key)?.label ?? key
}
