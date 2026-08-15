import { Pencil, Trash2, ArrowLeftRight, ArrowUp, ArrowDown, ArrowUpDown, Sparkles } from 'lucide-react'
import type { Transaction, CostCenter } from '../../db/models'
import { formatCurrencySigned, formatDate } from '../../lib/format'
import { TransactionTypeBadge } from './TransactionTypeBadge'
import { TransactionStatusPill } from '../ui/StatusPill'
import { transactionKindMeta } from '../../lib/transactionKind'
import type { TransactionSortKey, SortDir } from '../../lib/sorting'
import type { ClassificationSuggestion } from '../../lib/importRules'

interface TransactionsTableProps {
  transactions: Transaction[]
  costCenters: CostCenter[]
  emptyMessage?: string
  onEdit?: (t: Transaction) => void
  onDelete?: (t: Transaction) => void
  /** Ativa a coluna de checkboxes + "selecionar todos" (respeitando sempre a lista já filtrada
   * recebida em `transactions`). */
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleOne?: (id: string) => void
  onToggleAll?: (ids: string[], checked: boolean) => void
  /** Ordenação (opcional) — quando `onSortChange` é passado, os cabeçalhos de Data/Descrição/Valor/
   * Categoria/Centro de custo viram botões clicáveis com indicador visual de qual ordenação está
   * ativa. A ordenação em si (sobre o conjunto já filtrado) é feita por quem chama este componente,
   * com `sortTransactions` de `lib/sorting` — a tabela só exibe o estado atual. */
  sortKey?: TransactionSortKey
  sortDir?: SortDir
  onSortChange?: (key: TransactionSortKey) => void
  /** Sugestão de Centro de Custo/Categoria por id de lançamento (aprendida a partir de classificações
   * manuais anteriores da mesma contraparte) — nunca aplicada sozinha, só exibida até a usuária clicar
   * em "Aplicar" (`onApplySuggestion`). */
  suggestions?: Map<string, ClassificationSuggestion>
  onApplySuggestion?: (t: Transaction, suggestion: ClassificationSuggestion) => void
}

function SortableHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSortChange,
  className = '',
}: {
  label: string
  columnKey: TransactionSortKey
  sortKey?: TransactionSortKey
  sortDir?: SortDir
  onSortChange?: (key: TransactionSortKey) => void
  className?: string
}) {
  if (!onSortChange) return <th className={className}>{label}</th>
  const isActive = sortKey === columnKey
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSortChange(columnKey)}
        className={['inline-flex items-center gap-1 transition-colors hover:text-rose-700', isActive ? 'text-rose-700' : ''].join(' ')}
        aria-label={`Ordenar por ${label}${isActive ? (sortDir === 'asc' ? ', crescente' : ', decrescente') : ''}`}
      >
        {label}
        {isActive ? sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ArrowUpDown size={10} className="text-neutral-300" />}
      </button>
    </th>
  )
}

/** Monta o texto completo (nunca truncado) exibido no tooltip nativo (hover) de uma linha da
 * tabela — reúne descrição, histórico/descrição original e contraparte, já que qualquer um dos três
 * pode ter sido cortado visualmente pelo `truncate`. O clique (quando `onEdit` está disponível) abre
 * o formulário de edição com todos os campos, incluindo os que nunca aparecem na tabela (documento,
 * conta, categoria, centro de custo, observação). */
function fullDescriptionTitle(t: Transaction): string {
  const parts = [t.description]
  if (t.originalDescription && t.originalDescription !== t.description) parts.push(t.originalDescription)
  if (t.counterparty) parts.push(t.counterparty)
  return parts.join(' — ')
}

export function resolveCostCenterName(costCenters: CostCenter[], costCenterId: string | null): string {
  if (!costCenterId) return '—'
  return costCenters.find((c) => c.id === costCenterId)?.name ?? '—'
}

export function resolveCategoryName(costCenters: CostCenter[], costCenterId: string | null, categoryId: string | null): string {
  if (!costCenterId || !categoryId) return '—'
  const cc = costCenters.find((c) => c.id === costCenterId)
  return cc?.categories.find((cat) => cat.id === categoryId)?.name ?? '—'
}

export function TransactionsTable({
  transactions,
  costCenters,
  emptyMessage = 'Nenhum lançamento encontrado.',
  onEdit,
  onDelete,
  selectable = false,
  selectedIds,
  onToggleOne,
  onToggleAll,
  sortKey,
  sortDir,
  onSortChange,
  suggestions,
  onApplySuggestion,
}: TransactionsTableProps) {
  if (transactions.length === 0) {
    return <p className="py-10 text-center text-[14px] text-neutral-500">{emptyMessage}</p>
  }

  const showActions = Boolean(onEdit || onDelete)
  const allIds = transactions.map((t) => t.id)
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds?.has(id))

  return (
    <div className="-mx-5 overflow-x-auto px-5 lg:-mx-6 lg:px-6">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="text-[12px] uppercase tracking-wide text-neutral-400">
            {selectable && (
              <th className="w-8 pb-3 pr-2 font-medium">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={allSelected}
                  onChange={(e) => onToggleAll?.(allIds, e.target.checked)}
                />
              </th>
            )}
            <SortableHeader label="Data" columnKey="date" sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} className="pb-3 pr-4 font-medium" />
            <SortableHeader
              label="Descrição"
              columnKey="description"
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={onSortChange}
              className="pb-3 pr-4 font-medium"
            />
            <th className="pb-3 pr-4 font-medium">Tipo</th>
            <SortableHeader label="Valor" columnKey="amount" sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} className="pb-3 pr-4 font-medium" />
            <SortableHeader
              label="Centro de custo"
              columnKey="centroDeCusto"
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={onSortChange}
              className="pb-3 pr-4 font-medium"
            />
            <SortableHeader
              label="Categoria"
              columnKey="categoria"
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={onSortChange}
              className="pb-3 pr-4 font-medium"
            />
            <th className="pb-3 font-medium">Status</th>
            {showActions && <th className="pb-3 pl-4 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const suggestion = suggestions?.get(t.id)
            return (
            <tr key={t.id} className="border-t border-[var(--border-hairline)] text-[13.5px]">
              {selectable && (
                <td className="py-3 pr-2">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${t.description}`}
                    checked={Boolean(selectedIds?.has(t.id))}
                    onChange={() => onToggleOne?.(t.id)}
                  />
                </td>
              )}
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-500 tabular-nums">{formatDate(t.date)}</td>
              <td className="max-w-[220px] py-3 pr-4">
                {/* Descrição truncada: acessível por completo via tooltip (hover) E clique (abre o
                    mesmo formulário de edição já existente) — funciona também em telas de toque,
                    onde não há hover. Quando não há onEdit disponível, o texto continua com o
                    tooltip nativo, só sem o clique. */}
                {onEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    title={fullDescriptionTitle(t)}
                    className="block w-full text-left"
                    aria-label={`Ver detalhes de ${t.description}`}
                  >
                    <p className="truncate font-medium text-neutral-800 hover:text-rose-700">
                      {t.description}
                      {t.source === 'importado' && (
                        <span className="ml-1.5 rounded-full bg-[var(--color-neutral-100)] px-1.5 py-0.5 align-middle text-[10px] font-medium text-neutral-500">
                          Importado
                        </span>
                      )}
                      {t.transferId && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-medium"
                          style={{ color: 'var(--color-neutral-600)', background: 'var(--color-neutral-100)' }}
                        >
                          <ArrowLeftRight size={9} /> Transferência
                        </span>
                      )}
                    </p>
                    {(t.counterparty || t.originalDescription || t.kind) && (
                      <p className="truncate text-[11.5px] text-neutral-400">
                        {[t.counterparty || t.originalDescription, transactionKindMeta[t.kind]?.label].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                ) : (
                  <>
                    <p className="truncate font-medium text-neutral-800" title={fullDescriptionTitle(t)}>
                      {t.description}
                      {t.source === 'importado' && (
                        <span className="ml-1.5 rounded-full bg-[var(--color-neutral-100)] px-1.5 py-0.5 align-middle text-[10px] font-medium text-neutral-500">
                          Importado
                        </span>
                      )}
                      {t.transferId && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-medium"
                          style={{ color: 'var(--color-neutral-600)', background: 'var(--color-neutral-100)' }}
                        >
                          <ArrowLeftRight size={9} /> Transferência
                        </span>
                      )}
                    </p>
                    {(t.counterparty || t.originalDescription || t.kind) && (
                      <p className="truncate text-[11.5px] text-neutral-400" title={fullDescriptionTitle(t)}>
                        {[t.counterparty || t.originalDescription, transactionKindMeta[t.kind]?.label].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </>
                )}
              </td>
              <td className="py-3 pr-4">
                <TransactionTypeBadge kind={t.kind} />
              </td>
              <td
                className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums"
                style={{ color: t.direction === 'entrada' ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
              >
                {formatCurrencySigned(t.amount, t.direction)}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">
                {t.costCenterId ? (
                  resolveCostCenterName(costCenters, t.costCenterId)
                ) : suggestion ? (
                  <span
                    className="inline-flex flex-wrap items-center gap-1 text-[12px] font-medium"
                    style={{ color: 'var(--color-status-good)' }}
                    title={
                      suggestion.source === 'rule'
                        ? 'Sugerido a partir de uma regra de classificação aprendida'
                        : 'Sugerido a partir do histórico de classificações anteriores desta contraparte'
                    }
                  >
                    <Sparkles size={11} /> {resolveCostCenterName(costCenters, suggestion.costCenterId)}
                    {onApplySuggestion && (
                      <button
                        type="button"
                        onClick={() => onApplySuggestion(t, suggestion)}
                        className="rounded-full px-1.5 py-0.5 underline decoration-dotted hover:text-rose-700"
                      >
                        Aplicar
                      </button>
                    )}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-neutral-600">
                {t.costCenterId
                  ? resolveCategoryName(costCenters, t.costCenterId, t.categoryId)
                  : suggestion
                    ? resolveCategoryName(costCenters, suggestion.costCenterId, suggestion.categoryId)
                    : '—'}
              </td>
              <td className="py-3">
                <TransactionStatusPill status={t.status} />
              </td>
              {showActions && (
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(t)}
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Editar lançamento"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(t)}
                        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                        aria-label="Excluir lançamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
