import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { SearchInput } from '../components/ui/SearchInput'
import { Card } from '../components/ui/Card'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { transactions } from '../data/transactions'
import { costCenters } from '../data/costCenters'

const quickFilters = ['Casa', 'Pessoal', 'Trabalho', 'Alimentação', 'Estética']

export default function Search() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter((t) =>
      [t.description, t.category, t.costCenter].some((field) => field.toLowerCase().includes(q)),
    )
  }, [query])

  return (
    <div className="space-y-6">
      <PageHeader title="Buscar" subtitle="Encontre lançamentos por nome, descrição, categoria ou centro de custo." />

      <SearchInput
        size="lg"
        placeholder="Ex.: mercado, energia, pix, salão..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {quickFilters.map((f) => (
          <button
            key={f}
            onClick={() => setQuery(f)}
            className="rounded-full bg-[var(--color-neutral-100)] px-3.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-rose-50 hover:text-rose-800"
          >
            {f}
          </button>
        ))}
        {costCenters.slice(0, 3).map((cc) => (
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

      <Card padded={false}>
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
          <TransactionsTable transactions={results} emptyMessage="Nenhum lançamento encontrado para essa busca." />
        </div>
      </Card>
    </div>
  )
}
