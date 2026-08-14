import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { MagnitudeBarChart, blueSequential } from '../components/charts/MagnitudeBarChart'
import { MonthlyComparisonChart } from '../components/charts/MonthlyComparisonChart'
import { BalanceEvolutionChart } from '../components/charts/BalanceEvolutionChart'
import { spendByCostCenter, spendByCategory, monthlyComparison, balanceEvolution } from '../data/reports'
import { monthSummary } from '../data/cashflow'
import { totalBalance } from '../data/accounts'
import { formatCurrency } from '../lib/format'
import { TrendingUp, TrendingDown, Scale, Wallet } from 'lucide-react'

export default function Reports() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Uma visão consolidada da sua vida financeira. Dados fictícios nesta fase."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Entradas" value={formatCurrency(monthSummary.entradas)} icon={TrendingUp} accent="var(--color-cat-teal)" />
        <StatTile label="Saídas" value={formatCurrency(monthSummary.saidas)} icon={TrendingDown} accent="var(--color-cat-rose)" />
        <StatTile label="Resultado" value={formatCurrency(monthSummary.resultado)} icon={Scale} accent="var(--color-status-good)" />
        <StatTile label="Saldo atual" value={formatCurrency(totalBalance)} icon={Wallet} accent="var(--color-rose-700)" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Gastos por centro de custo</CardTitle>
          <MagnitudeBarChart data={spendByCostCenter} />
        </Card>
        <Card>
          <CardTitle>Gastos por categoria</CardTitle>
          <MagnitudeBarChart data={spendByCategory} ramp={blueSequential} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle>Comparação entre meses</CardTitle>
          <MonthlyComparisonChart data={monthlyComparison} />
        </Card>
        <Card className="min-w-0">
          <CardTitle>Evolução do saldo</CardTitle>
          <BalanceEvolutionChart data={balanceEvolution} />
        </Card>
      </div>

      <Card className="bg-rose-50/60">
        <p className="text-[13.5px] leading-relaxed text-neutral-700">
          Nesta primeira fase os relatórios usam apenas dados fictícios para validar o layout. Na próxima fase, esta
          tela passará a consolidar automaticamente os lançamentos reais, incluindo filtros por período, conta e
          centro de custo.
        </p>
      </Card>
    </div>
  )
}
