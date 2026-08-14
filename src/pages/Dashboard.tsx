import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingUp, TrendingDown, Scale, Plus, Gauge } from 'lucide-react'
import { Card, CardTitle } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AccountCard } from '../components/accounts/AccountCard'
import { AccountFormModal, type AccountFormValues } from '../components/accounts/AccountFormModal'
import { AttentionList } from '../components/alerts/AttentionList'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { CashFlowChart } from '../components/charts/CashFlowChart'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { monthlyCashFlowSeries, spendingStatus } from '../lib/aggregations'
import { formatCurrency, parseCurrencyInput } from '../lib/format'
import { brand, greeting } from '../config/brand'
import type { Account } from '../db/models'

export default function Dashboard() {
  const {
    accounts,
    transactions,
    costCenters,
    profile,
    totalBalance,
    monthSummary,
    recentTransactions,
    alerts,
    accountBalance,
    addAccount,
    updateAccount,
    deleteAccount,
    spendingLimits,
  } = useData()
  const toast = useToast()
  const confirm = useConfirm()

  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const openNewAccount = () => {
    setEditingAccount(null)
    setAccountModalOpen(true)
  }
  const openEditAccount = (account: Account) => {
    setEditingAccount(account)
    setAccountModalOpen(true)
  }

  const handleSubmitAccount = async (values: AccountFormValues) => {
    const payload = {
      bank: values.bank.trim(),
      nickname: values.nickname.trim() || undefined,
      type: values.type,
      openingBalance: parseCurrencyInput(values.openingBalance),
      openingDate: values.openingDate,
    }
    if (editingAccount) {
      await updateAccount(editingAccount.id, payload)
      toast.show('Conta atualizada com sucesso.')
    } else {
      await addAccount(payload)
      toast.show('Conta adicionada com sucesso.')
    }
  }

  const handleDeleteAccount = async () => {
    if (!editingAccount) return
    const linkedCount = transactions.filter((t) => t.accountId === editingAccount.id).length
    const ok = await confirm({
      title: 'Excluir conta',
      description:
        linkedCount > 0
          ? `Esta conta possui ${linkedCount} lançamento(s) associado(s). Excluí-la também removerá esses lançamentos. Deseja continuar?`
          : 'Tem certeza que deseja excluir esta conta? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteAccount(editingAccount.id)
    setAccountModalOpen(false)
    toast.show('Conta excluída.', 'info')
  }

  const cashFlowData = monthlyCashFlowSeries(accounts, transactions)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[24px] font-semibold text-neutral-900 lg:text-[28px]">{greeting(profile.name)}</h1>
        <p className="mt-1.5 text-[14.5px] text-neutral-500">{brand.tagline}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Saldo total" value={formatCurrency(totalBalance)} icon={Wallet} accent="var(--color-rose-700)" />
        <StatTile
          label="Entradas do mês"
          value={formatCurrency(monthSummary.entradas)}
          icon={TrendingUp}
          accent="var(--color-cat-teal)"
        />
        <StatTile
          label="Saídas do mês"
          value={formatCurrency(monthSummary.saidas)}
          icon={TrendingDown}
          accent="var(--color-cat-rose)"
        />
        <StatTile
          label="Resultado do mês"
          value={formatCurrency(monthSummary.resultado)}
          icon={Scale}
          accent={monthSummary.resultado >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)'}
          deltaLabel={monthSummary.resultado >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
          deltaDirection={monthSummary.resultado >= 0 ? 'up' : 'down'}
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[16.5px] font-semibold text-neutral-900">Minhas contas</h2>
          {accounts.length > 0 && (
            <span className="text-[13px] text-neutral-500">Saldo total = soma de {accounts.length} contas</span>
          )}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} balance={accountBalance(acc.id)} onEdit={() => openEditAccount(acc)} />
          ))}
          <button
            type="button"
            onClick={openNewAccount}
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
          {transactions.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nenhum lançamento ainda"
              description="Assim que você registrar entradas e saídas, o fluxo de caixa aparece aqui."
            />
          ) : (
            <CashFlowChart data={cashFlowData} />
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>Precisa de atenção</CardTitle>
            {alerts.length === 0 ? (
              <p className="py-8 text-center text-[13.5px] text-neutral-500">Tudo em dia por aqui. 🌷</p>
            ) : (
              <AttentionList alerts={alerts} />
            )}
          </Card>

          <Card className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <Gauge size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-neutral-500">Meta do mês</p>
              {spendingLimits.monthly ? (
                (() => {
                  const pct = Math.round((monthSummary.saidas / spendingLimits.monthly!) * 100)
                  const status = spendingStatus(pct)
                  return (
                    <>
                      <p className="truncate text-[13.5px] font-semibold text-neutral-900">
                        {formatCurrency(monthSummary.saidas)} de {formatCurrency(spendingLimits.monthly!)}
                      </p>
                      <div className="mt-1.5">
                        <ProgressBar value={pct} color={status.color} height={6} gradient={false} />
                      </div>
                      <p className="mt-1 text-[11.5px] font-medium" style={{ color: status.color }}>
                        {pct}% utilizado · {status.label}
                      </p>
                    </>
                  )
                })()
              ) : (
                <Link to="/metas" className="text-[12.5px] font-medium text-rose-700 hover:underline">
                  Definir meta de gasto mensal
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="p-5 pb-0 lg:p-6 lg:pb-0">
          <CardTitle hint={<Link to="/buscar" className="text-[13px] font-medium text-rose-700 hover:underline">Ver todos</Link>}>
            Últimos lançamentos
          </CardTitle>
        </div>
        <div className="p-5 pt-0 lg:p-6 lg:pt-0">
          {recentTransactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhum lançamento cadastrado"
              description="Vá até o Fluxo de Caixa para registrar sua primeira entrada ou saída."
            />
          ) : (
            <TransactionsTable transactions={recentTransactions} costCenters={costCenters} />
          )}
        </div>
      </Card>

      <AccountFormModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        onSubmit={handleSubmitAccount}
        onDelete={editingAccount ? handleDeleteAccount : undefined}
        account={editingAccount}
      />
    </div>
  )
}
