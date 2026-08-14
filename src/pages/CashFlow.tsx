import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { CashFlowChart } from '../components/charts/CashFlowChart'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { StatTile } from '../components/ui/StatTile'
import { monthlyCashFlow, dailyCashFlow, monthSummary } from '../data/cashflow'
import { transactions } from '../data/transactions'
import { formatCurrency } from '../lib/format'
import { TrendingUp, TrendingDown, Scale } from 'lucide-react'

const periods = [
  { id: 'mensal', label: 'Últimos 6 meses' },
  { id: 'diario', label: 'Últimos 6 dias' },
] as const

export default function CashFlow() {
  const [period, setPeriod] = useState<(typeof periods)[number]['id']>('mensal')
  const data = period === 'mensal' ? monthlyCashFlow : dailyCashFlow

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Acompanhe entradas, saídas e a evolução do seu saldo ao longo do tempo."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Entradas do mês"
          value={formatCurrency(monthSummary.entradas)}
          icon={TrendingUp}
          accent="var(--color-cat-teal)"
          deltaLabel="3,7% que julho"
          deltaDirection="up"
        />
        <StatTile
          label="Saídas do mês"
          value={formatCurrency(monthSummary.saidas)}
          icon={TrendingDown}
          accent="var(--color-cat-rose)"
          deltaLabel="9,8% que julho"
          deltaDirection="up"
        />
        <StatTile
          label="Resultado do mês"
          value={formatCurrency(monthSummary.resultado)}
          icon={Scale}
          accent="var(--color-status-good)"
          deltaLabel="Saldo positivo"
          deltaDirection="up"
        />
      </div>

      <Card>
        <CardTitle
          hint={
            <div className="flex rounded-full bg-[var(--color-neutral-100)] p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={[
                    'rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    period === p.id ? 'bg-white text-rose-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        >
          Entradas, saídas e saldo acumulado
        </CardTitle>
        <CashFlowChart data={data} height={340} />
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 lg:p-6 lg:pb-0">
          <CardTitle>Todos os lançamentos</CardTitle>
        </div>
        <div className="p-5 pt-0 lg:p-6 lg:pt-0">
          <TransactionsTable transactions={transactions} />
        </div>
      </Card>
    </div>
  )
}
