import { useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { EmptyState } from '../components/ui/EmptyState'
import { MonthYearSelector } from '../components/ui/MonthYearSelector'
import { MagnitudeBarChart, blueSequential } from '../components/charts/MagnitudeBarChart'
import { MonthlyComparisonChart } from '../components/charts/MonthlyComparisonChart'
import { BalanceEvolutionChart } from '../components/charts/BalanceEvolutionChart'
import { useData } from '../context/DataContext'
import { usePeriod } from '../context/PeriodContext'
import { monthlyCashFlowSeries, monthKey, monthTotals } from '../lib/aggregations'
import { formatCurrency } from '../lib/format'
import { isInternalTransferKind } from '../lib/transactionKind'
import { TrendingUp, TrendingDown, Scale, Wallet, PieChart } from 'lucide-react'

export default function Reports() {
  const { accounts, transactions, costCenters, totalBalance } = useData()
  const { period: currentMonth, label: periodLabel } = usePeriod()

  // Os relatórios mensais usam SEMPRE o período selecionado no seletor global (mesmo do Fluxo de
  // Caixa e Centros de Custo) — nunca "o mês atual" fixo. Transferências entre contas próprias
  // nunca entram em relatórios de gasto — o dinheiro só mudou de conta.
  const monthTx = transactions.filter(
    (t) => monthKey(t.date) === currentMonth && t.direction === 'saida' && !isInternalTransferKind(t.kind),
  )
  const periodTotals = useMemo(() => monthTotals(transactions, currentMonth), [transactions, currentMonth])
  const periodResultado = periodTotals.entradas - periodTotals.saidas

  const spendByCostCenter = costCenters
    .map((cc) => ({ name: cc.name, value: monthTx.filter((t) => t.costCenterId === cc.id).reduce((s, t) => s + t.amount, 0) }))
    .filter((d) => d.value > 0)

  const uncategorizedSpend = monthTx.filter((t) => !t.costCenterId).reduce((s, t) => s + t.amount, 0)
  if (uncategorizedSpend > 0) spendByCostCenter.push({ name: 'Sem centro de custo', value: uncategorizedSpend })

  const categoryTotals = new Map<string, number>()
  for (const t of monthTx) {
    const cc = costCenters.find((c) => c.id === t.costCenterId)
    const cat = cc?.categories.find((c) => c.id === t.categoryId)
    const label = cat ? cat.name : 'Sem categoria'
    categoryTotals.set(label, (categoryTotals.get(label) ?? 0) + t.amount)
  }
  const spendByCategory = Array.from(categoryTotals.entries()).map(([name, value]) => ({ name, value }))

  const series = monthlyCashFlowSeries(accounts, transactions)
  const monthlyComparison = series.map((p) => ({ month: p.label, entradas: p.entradas, saidas: p.saidas }))
  const balanceEvolution = series.map((p) => ({ month: p.label, saldo: p.saldo }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Uma visão consolidada da sua vida financeira, com base nos seus dados cadastrados."
        action={<MonthYearSelector />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`Entradas · ${periodLabel}`} value={formatCurrency(periodTotals.entradas)} icon={TrendingUp} accent="var(--color-cat-teal)" />
        <StatTile label={`Saídas · ${periodLabel}`} value={formatCurrency(periodTotals.saidas)} icon={TrendingDown} accent="var(--color-cat-rose)" />
        <StatTile
          label={`Resultado · ${periodLabel}`}
          value={formatCurrency(periodResultado)}
          icon={Scale}
          accent={periodResultado >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)'}
        />
        <StatTile label="Saldo atual" value={formatCurrency(totalBalance)} icon={Wallet} accent="var(--color-rose-700)" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Gastos por centro de custo · {periodLabel}</CardTitle>
          {spendByCostCenter.length === 0 ? (
            <EmptyState icon={PieChart} title={`Sem saídas classificadas em ${periodLabel}`} description="Registre saídas com centro de custo para ver a distribuição aqui." />
          ) : (
            <MagnitudeBarChart data={spendByCostCenter} />
          )}
        </Card>
        <Card>
          <CardTitle>Gastos por categoria · {periodLabel}</CardTitle>
          {spendByCategory.length === 0 ? (
            <EmptyState icon={PieChart} title={`Sem saídas classificadas em ${periodLabel}`} description="Registre saídas com categoria para ver a distribuição aqui." />
          ) : (
            <MagnitudeBarChart data={spendByCategory} ramp={blueSequential} />
          )}
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
          Os relatórios acima são calculados a partir das suas contas e lançamentos cadastrados. Filtros por período,
          conta e centro de custo, além de exportação, ficam para uma próxima fase.
        </p>
      </Card>
    </div>
  )
}
