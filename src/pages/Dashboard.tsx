import { Wallet, TrendingUp, TrendingDown, Scale, Plus } from 'lucide-react'
import { Card, CardTitle } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { AccountCard } from '../components/accounts/AccountCard'
import { AttentionList } from '../components/alerts/AttentionList'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { CashFlowChart } from '../components/charts/CashFlowChart'
import { accounts, totalBalance } from '../data/accounts'
import { attentionAlerts } from '../data/alerts'
import { recentTransactions } from '../data/transactions'
import { monthlyCashFlow, monthSummary } from '../data/cashflow'
import { formatCurrency } from '../lib/format'
import { brand, greeting } from '../config/brand'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[24px] font-semibold text-neutral-900 lg:text-[28px]">{greeting()}</h1>
        <p className="mt-1.5 text-[14.5px] text-neutral-500">{brand.tagline}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Saldo total"
          value={formatCurrency(totalBalance)}
          icon={Wallet}
          accent="var(--color-rose-700)"
          deltaLabel="4,8% que o mês passado"
          deltaDirection="up"
          trend={[15200, 15900, 16800, 17600, 18000, 18450.75]}
        />
        <StatTile
          label="Entradas do mês"
          value={formatCurrency(monthSummary.entradas)}
          icon={TrendingUp}
          accent="var(--color-cat-teal)"
          deltaLabel="3,7% que julho"
          deltaDirection="up"
          trend={[6800, 7900, 7100, 8200, 8500]}
        />
        <StatTile
          label="Saídas do mês"
          value={formatCurrency(monthSummary.saidas)}
          icon={TrendingDown}
          accent="var(--color-cat-rose)"
          deltaLabel="9,8% que julho"
          deltaDirection="up"
          trend={[5600, 6200, 6700, 5900, 5320]}
        />
        <StatTile
          label="Resultado do mês"
          value={formatCurrency(monthSummary.resultado)}
          icon={Scale}
          accent="var(--color-status-good)"
          deltaLabel="Saldo positivo"
          deltaDirection="up"
          trend={[1200, 1700, 400, 2300, 3180]}
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[16.5px] font-semibold text-neutral-900">Minhas contas</h2>
          <span className="text-[13px] text-neutral-500">
            Saldo total = soma de {accounts.length} contas
          </span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
          <button
            type="button"
            className="flex min-w-[180px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-300 bg-rose-50/40 p-5 text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Plus size={20} />
            <span className="text-[13.5px] font-medium">Adicionar conta</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardTitle hint={<Link to="/fluxo-de-caixa" className="text-[13px] font-medium text-rose-700 hover:underline">Ver tudo</Link>}>
            Fluxo de caixa
          </CardTitle>
          <CashFlowChart data={monthlyCashFlow} />
        </Card>

        <Card>
          <CardTitle>Precisa de atenção</CardTitle>
          <AttentionList alerts={attentionAlerts} />
        </Card>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="p-5 pb-0 lg:p-6 lg:pb-0">
          <CardTitle hint={<Link to="/buscar" className="text-[13px] font-medium text-rose-700 hover:underline">Ver todos</Link>}>
            Últimos lançamentos
          </CardTitle>
        </div>
        <div className="p-5 pt-0 lg:p-6 lg:pt-0">
          <TransactionsTable transactions={recentTransactions} />
        </div>
      </Card>
    </div>
  )
}
