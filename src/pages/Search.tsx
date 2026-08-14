import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { TransactionsTable, resolveCostCenterName, resolveCategoryName } from '../components/transactions/TransactionsTable'
import { useData } from '../context/DataContext'
import { Search as SearchIcon } from 'lucide-react'

export default function Search() {
  const { transactions, costCenters } = useData()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((t) =>
      [t.description, resolveCostCenterName(costCenters, t.costCenterId), resolveCategoryName(costCenters, t.costCenterId, t.categoryId)].some(
        (field) => field.toLowerCase().includes(q),
      ),
    )
  }, [query, transactions, costCenters])

  const quickFilters = costCenters.slice(0, 5).map((cc) => `${cc.emoji} ${cc.name}`)

  return (
    <div className="space-y-6">
      <PageHeader title="Buscar" subtitle="Encontre lançamentos por nome, descrição, categoria ou centro de custo." />

      <SearchInput
        size="lg"
        placeholder="Ex.: mercado, energia, pix, salão..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {quickFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {costCenters.slice(0, 5).map((cc) => (
            <button
              key={cc.id}
              onClick={() => setQuery(cc.name)}
              className="rounded-full bg-[var(--color-neutral-100)] px-3.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-rose-50 hover:text-rose-800"
            >
              {cc.emoji} {cc.name}
            </button>
          ))}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-rose-700 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      <Card padded={false}>
        {transactions.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title="Nenhum lançamento para buscar ainda"
            description="Assim que você registrar entradas e saídas no Fluxo de Caixa, elas aparecem aqui."
          />
        ) : (
          <>
            <div className="flex items-center justify-between p-5 pb-4 lg:px-6">
              <p className="text-[13.5px] text-neutral-500">
                {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
                {query && (
                  <>
                    {' '}
                    para "<span className="font-medium text-neutral-700">{query}</span>"
                  </>
                )}
              </p>
            </div>
            <div className="p-5 pt-0 lg:p-6 lg:pt-0">
              <TransactionsTable transactions={results} costCenters={costCenters} emptyMessage="Nenhum lançamento encontrado para essa busca." />
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
