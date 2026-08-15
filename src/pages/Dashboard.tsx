import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Wallet, TrendingUp, TrendingDown, Scale, Plus, Gauge, LayoutDashboard, GripVertical, Check, Star } from 'lucide-react'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatTile } from '../components/ui/StatTile'
import { ProgressBar } from '../components/ui/ProgressBar'
import { AccountCard } from '../components/accounts/AccountCard'
import { AccountFormModal, type AccountFormValues } from '../components/accounts/AccountFormModal'
import { AttentionList } from '../components/alerts/AttentionList'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { TransactionFormModal, type TransactionFormValues } from '../components/transactions/TransactionFormModal'
import { CashFlowChart } from '../components/charts/CashFlowChart'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { monthlyCashFlowSeries, spendingStatus, costCenterSpendInMonth, costCenterIncomeInMonth, monthKey, todayIso } from '../lib/aggregations'
import { formatCurrency, parseCurrencyInput } from '../lib/format'
import { brand, greeting } from '../config/brand'
import type { Account, DashboardSectionKey, Transaction } from '../db/models'

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
    updateTransaction,
    deleteTransaction,
    spendingLimits,
    dashboardLayout,
    updateDashboardLayout,
  } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [reordering, setReordering] = useState(false)
  const [draggedKey, setDraggedKey] = useState<DashboardSectionKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<DashboardSectionKey | null>(null)
  // Edição de lançamento a partir do card "Últimos lançamentos" — reaproveita o mesmo formulário
  // usado no Fluxo de Caixa e nos Centros de Custo, para que a descrição truncada seja sempre
  // acessível por completo (clique) em qualquer lugar onde a tabela de lançamentos aparece.
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const openNewAccount = () => {
    setEditingAccount(null)
    setAccountModalOpen(true)
  }
  const openEditAccount = (account: Account) => {
    setEditingAccount(account)
    setAccountModalOpen(true)
  }

  // Permite chegar aqui a partir de um resultado clicável da busca geral (/buscar), já abrindo a
  // conta correspondente — sem navegação quebrada.
  const location = useLocation()
  useEffect(() => {
    const targetId = (location.state as { openAccountId?: string } | null)?.openAccountId
    if (!targetId) return
    const acc = accounts.find((a) => a.id === targetId)
    if (acc) openEditAccount(acc)
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

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

  // ---------- Editar lançamento a partir de "Últimos lançamentos" (mesmo padrão do Fluxo de Caixa e
  // dos Centros de Custo) ----------
  const openEditTransaction = (t: Transaction) => {
    setEditingTx(t)
    setTxModalOpen(true)
  }

  const handleTxSubmit = async (values: TransactionFormValues) => {
    if (!editingTx) return
    const payload = {
      direction: values.direction,
      kind: values.kind,
      amount: parseCurrencyInput(values.amount),
      date: values.date,
      description: values.description.trim(),
      originalDescription: values.originalDescription.trim() || undefined,
      counterparty: values.counterparty.trim() || undefined,
      document: values.document.trim() || undefined,
      accountId: values.accountId,
      costCenterId: values.costCenterId || null,
      categoryId: values.categoryId || null,
      note: values.note.trim() || undefined,
    }
    await updateTransaction(editingTx.id, payload)
    toast.show('Lançamento atualizado.')
  }

  const handleDeleteTransaction = async (t: Transaction) => {
    const ok = await confirm({
      title: 'Excluir lançamento',
      description: `Excluir "${t.description}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteTransaction(t.id)
    toast.show('Lançamento excluído.', 'info')
  }

  const cashFlowData = monthlyCashFlowSeries(accounts, transactions)
  const currentMonth = monthKey(todayIso())
  const favoriteCostCenters = dashboardLayout.favoriteCostCenterIds
    .map((id) => costCenters.find((cc) => cc.id === id))
    .filter((cc): cc is NonNullable<typeof cc> => Boolean(cc))

  // ---------- Organizar painel (drag-and-drop, item 17) ----------
  const handleDrop = (overKey: DashboardSectionKey) => {
    if (!draggedKey || draggedKey === overKey) {
      setDraggedKey(null)
      setDragOverKey(null)
      return
    }
    const order = [...dashboardLayout.order]
    const from = order.indexOf(draggedKey)
    const to = order.indexOf(overKey)
    if (from === -1 || to === -1) return
    order.splice(from, 1)
    order.splice(to, 0, draggedKey)
    updateDashboardLayout({ order })
    setDraggedKey(null)
    setDragOverKey(null)
  }

  const visibleOrder = dashboardLayout.order.filter((key) => !dashboardLayout.hidden.includes(key))

  const wrap = (key: DashboardSectionKey, node: ReactNode) => (
    <div
      key={key}
      draggable={reordering}
      onDragStart={reordering ? () => setDraggedKey(key) : undefined}
      onDragOver={
        reordering
          ? (e) => {
              e.preventDefault()
              if (dragOverKey !== key) setDragOverKey(key)
            }
          : undefined
      }
      onDragLeave={reordering ? () => setDragOverKey((k) => (k === key ? null : k)) : undefined}
      onDrop={reordering ? () => handleDrop(key) : undefined}
      className={[
        reordering ? 'card-interactive relative rounded-xl' : '',
        reordering && draggedKey === key ? 'opacity-50' : '',
        reordering && dragOverKey === key && draggedKey !== key ? 'shadow-[var(--shadow-card-hover)] ring-2 ring-rose-300' : '',
      ].join(' ')}
    >
      {reordering && (
        <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400">
          <GripVertical size={13} className="cursor-grab" />
          Arraste para reorganizar
        </div>
      )}
      {node}
    </div>
  )

  const sections: Partial<Record<DashboardSectionKey, ReactNode>> = {
    stats: (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Saldo total" value={formatCurrency(totalBalance)} icon={Wallet} accent="var(--color-rose-700)" />
        <StatTile label="Entradas do mês" value={formatCurrency(monthSummary.entradas)} icon={TrendingUp} accent="var(--color-cat-teal)" />
        <StatTile label="Saídas do mês" value={formatCurrency(monthSummary.saidas)} icon={TrendingDown} accent="var(--color-cat-rose)" />
        <StatTile
          label="Resultado do mês"
          value={formatCurrency(monthSummary.resultado)}
          icon={Scale}
          accent={monthSummary.resultado >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)'}
          deltaLabel={monthSummary.resultado >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
          deltaDirection={monthSummary.resultado >= 0 ? 'up' : 'down'}
        />
      </div>
    ),
    accounts: (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15.5px] font-semibold text-neutral-900">Minhas contas</h2>
          {accounts.length > 0 && <span className="text-[12.5px] text-neutral-500">Saldo total = soma de {accounts.length} contas</span>}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} balance={accountBalance(acc.id)} onEdit={() => openEditAccount(acc)} />
          ))}
          <button
            type="button"
            onClick={openNewAccount}
            className="flex min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-rose-300 bg-rose-50/40 px-4 py-3.5 text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Plus size={17} />
            <span className="text-[13px] font-medium">Adicionar conta</span>
          </button>
        </div>
      </section>
    ),
    cashflow: (
      <Card className="min-w-0">
        <CardTitle hint={<Link to="/fluxo-de-caixa" className="text-[13px] font-medium text-rose-700 hover:underline">Ver tudo</Link>}>
          Fluxo de caixa
        </CardTitle>
        {transactions.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Nenhum lançamento ainda" description="Assim que você registrar entradas e saídas, o fluxo de caixa aparece aqui." />
        ) : (
          <CashFlowChart data={cashFlowData} />
        )}
      </Card>
    ),
    attention: (
      <Card>
        <CardTitle>Precisa de atenção</CardTitle>
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-neutral-500">Tudo em dia por aqui.</p>
        ) : (
          <AttentionList alerts={alerts} />
        )}
      </Card>
    ),
    goal: (
      <Card className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
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
    ),
    favoriteCostCenters:
      favoriteCostCenters.length > 0 ? (
        <Card>
          <CardTitle hint={<Link to="/centros-de-custo" className="text-[13px] font-medium text-rose-700 hover:underline">Ver todos</Link>}>
            Centros de custo favoritos
          </CardTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {favoriteCostCenters.map((cc) => {
              const spend = costCenterSpendInMonth(transactions, cc.id, currentMonth)
              // Entradas do centro — exibidas separadamente do gasto, nunca somadas a ele.
              const income = costCenterIncomeInMonth(transactions, cc.id, currentMonth)
              return (
                <button
                  key={cc.id}
                  type="button"
                  onClick={() => navigate('/centros-de-custo', { state: { openCostCenterId: cc.id } })}
                  className="card-interactive flex flex-col gap-2 rounded-lg border border-[var(--border-hairline)] p-3.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{cc.emoji}</span>
                    <span className="truncate text-[13.5px] font-medium text-neutral-800">{cc.name}</span>
                    <Star size={12} className="ml-auto shrink-0 fill-rose-700 text-rose-700" />
                  </div>
                  <p className="font-display text-[17px] font-semibold tabular-nums text-neutral-900">{formatCurrency(spend.total)}</p>
                  <p className="text-[11.5px] text-neutral-500">
                    {spend.count} lançamento{spend.count === 1 ? '' : 's'} este mês
                  </p>
                  {income.count > 0 && (
                    <p className="text-[11.5px] font-medium text-[var(--color-status-good)]">
                      + {formatCurrency(income.total)} em entrada{income.count === 1 ? '' : 's'}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </Card>
      ) : null,
    recentTransactions: (
      <Card padded={false} className="overflow-hidden">
        <div className="p-4 pb-0 lg:p-5 lg:pb-0">
          <CardTitle hint={<Link to="/buscar" className="text-[13px] font-medium text-rose-700 hover:underline">Ver todos</Link>}>
            Últimos lançamentos
          </CardTitle>
        </div>
        <div className="p-4 pt-0 lg:p-5 lg:pt-0">
          {recentTransactions.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhum lançamento cadastrado" description="Vá até o Fluxo de Caixa para registrar sua primeira entrada ou saída." />
          ) : (
            <TransactionsTable
              transactions={recentTransactions}
              costCenters={costCenters}
              onEdit={openEditTransaction}
              onDelete={handleDeleteTransaction}
            />
          )}
        </div>
      </Card>
    ),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-neutral-900 lg:text-[26px]">{greeting(profile.name)}</h1>
          <p className="mt-1 text-[14px] text-neutral-500">{brand.tagline}</p>
        </div>
        <Button
          size="sm"
          variant={reordering ? 'primary' : 'secondary'}
          onClick={() => {
            setReordering((v) => !v)
            setDraggedKey(null)
            setDragOverKey(null)
          }}
        >
          {reordering ? (
            <>
              <Check size={15} /> Concluir
            </>
          ) : (
            <>
              <LayoutDashboard size={15} /> Organizar painel
            </>
          )}
        </Button>
      </div>

      {visibleOrder.map((key) => {
        const content = sections[key]
        if (!content) return null
        return wrap(key, content)
      })}

      <AccountFormModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        onSubmit={handleSubmitAccount}
        onDelete={editingAccount ? handleDeleteAccount : undefined}
        account={editingAccount}
      />

      <TransactionFormModal
        open={txModalOpen}
        onClose={() => {
          setTxModalOpen(false)
          setEditingTx(null)
        }}
        onSubmit={handleTxSubmit}
        onDelete={
          editingTx
            ? async () => {
                setTxModalOpen(false)
                await handleDeleteTransaction(editingTx)
              }
            : undefined
        }
        accounts={accounts}
        costCenters={costCenters}
        transaction={editingTx}
      />
    </div>
  )
}
