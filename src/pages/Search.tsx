import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { resolveCostCenterName, resolveCategoryName } from '../components/transactions/TransactionsTable'
import { transactionKindMeta } from '../lib/transactionKind'
import { useData } from '../context/DataContext'
import { formatCurrency, formatDate } from '../lib/format'
import { matchesQuery, transactionSearchFields } from '../lib/textSearch'
import { getBillDisplayStatus } from '../lib/aggregations'
import { accountTypeLabel } from '../components/accounts/AccountCard'
import {
  Search as SearchIcon,
  ArrowLeftRight,
  Layers,
  Wallet,
  ReceiptText,
  Target,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

/**
 * Busca geral do sistema — procura em lançamentos, centros de custo/categorias, contas bancárias,
 * contas a pagar e metas/cofrinho. Cada resultado é clicável e navega para a tela correspondente já
 * abrindo o item certo (nunca navegação quebrada). A busca nunca altera dados, é só filtro/localização.
 */
export default function Search() {
  const { transactions, costCenters, accounts, bills, goals } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const transactionResults = useMemo(() => {
    if (!query.trim()) return []
    return transactions
      .filter((t) => matchesQuery(transactionSearchFields(t, costCenters, accounts), query))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 40)
  }, [transactions, costCenters, accounts, query])

  const costCenterResults = useMemo(() => {
    if (!query.trim()) return []
    return costCenters.filter((cc) => matchesQuery([cc.name, ...cc.categories.map((c) => c.name)], query))
  }, [costCenters, query])

  const accountResults = useMemo(() => {
    if (!query.trim()) return []
    return accounts.filter((a) => matchesQuery([a.bank, a.nickname], query))
  }, [accounts, query])

  const billResults = useMemo(() => {
    if (!query.trim()) return []
    return bills.filter((b) => matchesQuery([b.name, b.originalDescription], query)).slice(0, 40)
  }, [bills, query])

  const goalResults = useMemo(() => {
    if (!query.trim()) return []
    return goals.filter((g) => matchesQuery([g.name], query))
  }, [goals, query])

  const totalResults =
    transactionResults.length + costCenterResults.length + accountResults.length + billResults.length + goalResults.length

  const hasQuery = query.trim().length > 0
  const quickFilters = costCenters.slice(0, 5).map((cc) => `${cc.emoji} ${cc.name}`)

  return (
    <div className="space-y-6">
      <PageHeader title="Buscar" subtitle="Encontre lançamentos, centros de custo, contas, contas a pagar e metas em qualquer lugar do sistema." />

      <SearchInput
        size="lg"
        placeholder="Ex.: mercado, energia, pix, salão..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {(quickFilters.length > 0 || hasQuery) && (
        <div className="flex flex-wrap gap-2">
          {!hasQuery &&
            costCenters.slice(0, 5).map((cc) => (
              <button
                key={cc.id}
                onClick={() => setQuery(cc.name)}
                className="rounded-full bg-[var(--color-neutral-100)] px-3.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-rose-50 hover:text-rose-800"
              >
                {cc.emoji} {cc.name}
              </button>
            ))}
          {hasQuery && (
            <button
              onClick={() => setQuery('')}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-rose-700 hover:underline"
            >
              Limpar pesquisa
            </button>
          )}
        </div>
      )}

      {!hasQuery ? (
        <Card padded={false}>
          <EmptyState
            icon={SearchIcon}
            title="Digite algo para pesquisar"
            description="Busque por descrição, contraparte, categoria, centro de custo, conta, conta a pagar ou meta."
          />
        </Card>
      ) : totalResults === 0 ? (
        <Card padded={false}>
          <EmptyState icon={SearchIcon} title={`Nenhum resultado encontrado para "${query}"`} description="Tente outro termo ou verifique a ortografia." />
        </Card>
      ) : (
        <div className="space-y-5">
          <p className="text-[13.5px] text-neutral-500">
            {totalResults} {totalResults === 1 ? 'resultado' : 'resultados'} para "<span className="font-medium text-neutral-700">{query}</span>"
          </p>

          {transactionResults.length > 0 && (
            <ResultSection title="Lançamentos" icon={ArrowLeftRight}>
              {transactionResults.map((t) => (
                <ResultRow
                  key={t.id}
                  title={t.description}
                  subtitle={[
                    formatDate(t.date),
                    resolveCostCenterName(costCenters, t.costCenterId) !== '—'
                      ? `${resolveCostCenterName(costCenters, t.costCenterId)} → ${resolveCategoryName(costCenters, t.costCenterId, t.categoryId)}`
                      : transactionKindMeta[t.kind]?.label,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: t.direction === 'entrada' ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
                    >
                      {t.direction === 'entrada' ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </span>
                  }
                  onClick={() => navigate('/fluxo-de-caixa', { state: { openTransactionId: t.id } })}
                />
              ))}
            </ResultSection>
          )}

          {costCenterResults.length > 0 && (
            <ResultSection title="Centros de custo" icon={Layers}>
              {costCenterResults.map((cc) => (
                <ResultRow
                  key={cc.id}
                  title={`${cc.emoji} ${cc.name}`}
                  subtitle={`${cc.categories.length} categoria${cc.categories.length === 1 ? '' : 's'}`}
                  onClick={() => navigate('/centros-de-custo', { state: { openCostCenterId: cc.id } })}
                />
              ))}
            </ResultSection>
          )}

          {accountResults.length > 0 && (
            <ResultSection title="Contas bancárias" icon={Wallet}>
              {accountResults.map((a) => (
                <ResultRow
                  key={a.id}
                  title={a.nickname || a.bank}
                  subtitle={`${a.bank} · ${accountTypeLabel[a.type]}`}
                  onClick={() => navigate('/', { state: { openAccountId: a.id } })}
                />
              ))}
            </ResultSection>
          )}

          {billResults.length > 0 && (
            <ResultSection title="Contas a pagar" icon={ReceiptText}>
              {billResults.map((b) => (
                <ResultRow
                  key={b.id}
                  title={b.name}
                  subtitle={`Vence em ${formatDate(b.dueDate)} · ${getBillDisplayStatus(b) === 'paga' ? 'Paga' : getBillDisplayStatus(b) === 'vencida' ? 'Vencida' : 'Pendente'}`}
                  trailing={<span className="font-semibold tabular-nums text-neutral-900">{formatCurrency(b.amount)}</span>}
                  onClick={() => navigate('/contas-a-pagar', { state: { openBillId: b.id } })}
                />
              ))}
            </ResultSection>
          )}

          {goalResults.length > 0 && (
            <ResultSection title="Metas / Cofrinho" icon={Target}>
              {goalResults.map((g) => (
                <ResultRow
                  key={g.id}
                  title={`${g.emoji} ${g.name}`}
                  subtitle={`Meta: ${formatCurrency(g.target)}`}
                  onClick={() => navigate('/cofrinho', { state: { openGoalId: g.id } })}
                />
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] px-5 py-3.5 lg:px-6">
        <Icon size={15} className="text-rose-700" />
        <p className="text-[13px] font-semibold text-neutral-700">{title}</p>
      </div>
      <div className="divide-y divide-[var(--border-hairline)]">{children}</div>
    </Card>
  )
}

function ResultRow({
  title,
  subtitle,
  trailing,
  onClick,
}: {
  title: string
  subtitle?: string
  trailing?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-rose-50/60 lg:px-6"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-neutral-800">{title}</p>
        {subtitle && <p className="truncate text-[12px] text-neutral-500">{subtitle}</p>}
      </div>
      {trailing}
      <ChevronRight size={15} className="shrink-0 text-neutral-300" />
    </button>
  )
}
