import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { SpendingLimitCard } from '../components/spendinggoals/SpendingLimitCard'
import { SpendingLimitModal } from '../components/spendinggoals/SpendingLimitModal'
import { PlannedItemFormModal, type PlannedItemFormValues } from '../components/spendinggoals/PlannedItemFormModal'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { formatCurrency, parseCurrencyInput } from '../lib/format'
import { saidasNoDia, saidasNoMes, saidasNoAno, monthKey, yearKey, todayIso, projectMonthSpend } from '../lib/aggregations'
import { CalendarClock, CalendarRange, CalendarDays, Plus, Pencil, Trash2, ListChecks, TrendingUp } from 'lucide-react'
import type { PlannedItem } from '../db/models'

type LimitKind = 'daily' | 'monthly' | 'annual'

const limitMeta: Record<LimitKind, { title: string }> = {
  daily: { title: 'Definir limite diário' },
  monthly: { title: 'Definir limite mensal' },
  annual: { title: 'Definir limite anual' },
}

export default function SpendingGoals() {
  const { transactions, spendingLimits, updateSpendingLimits, plannedItems, addPlannedItem, updatePlannedItem, deletePlannedItem } = useData()
  const toast = useToast()
  const confirm = useConfirm()

  const [editingLimit, setEditingLimit] = useState<LimitKind | null>(null)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PlannedItem | null>(null)

  const today = todayIso()
  const spentToday = saidasNoDia(transactions, today)
  const spentMonth = saidasNoMes(transactions, monthKey(today))
  const spentYear = saidasNoAno(transactions, yearKey(today))
  const projectedMonth = projectMonthSpend(spentMonth, today)

  const handleSubmitLimit = async (value: number | undefined) => {
    if (!editingLimit) return
    updateSpendingLimits({ [editingLimit]: value })
    toast.show('Limite atualizado.')
  }

  const openNewItem = () => {
    setEditingItem(null)
    setItemModalOpen(true)
  }
  const openEditItem = (item: PlannedItem) => {
    setEditingItem(item)
    setItemModalOpen(true)
  }

  const handleSubmitItem = async (values: PlannedItemFormValues) => {
    const payload = {
      name: values.name.trim(),
      quantity: Number(values.quantity.replace(',', '.')),
      unitValue: parseCurrencyInput(values.unitValue),
    }
    if (editingItem) {
      await updatePlannedItem(editingItem.id, payload)
      toast.show('Item atualizado.')
    } else {
      await addPlannedItem(payload)
      toast.show('Item previsto adicionado.')
    }
  }

  const handleDeleteItem = async (item: PlannedItem) => {
    const ok = await confirm({
      title: 'Excluir item previsto',
      description: `Excluir "${item.name}" do planejamento diário?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deletePlannedItem(item.id)
    toast.show('Item excluído.', 'info')
  }

  const totalPrevisto = plannedItems.reduce((s, i) => s + i.quantity * i.unitValue, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas"
        subtitle="Limites de gasto — diferente do Cofrinho, aqui você compara o quanto gastou com o quanto planejou gastar."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SpendingLimitCard
          title="Limite diário"
          icon={CalendarClock}
          spent={spentToday}
          limit={spendingLimits.daily}
          onEditLimit={() => setEditingLimit('daily')}
        />
        <SpendingLimitCard
          title="Limite mensal"
          icon={CalendarRange}
          spent={spentMonth}
          limit={spendingLimits.monthly}
          onEditLimit={() => setEditingLimit('monthly')}
          footer={
            spendingLimits.monthly ? (
              <p className="flex items-center gap-1.5 text-[12px] text-neutral-500">
                <TrendingUp size={13} className="text-neutral-400" />
                Projeção do mês, no ritmo atual: <strong className="font-medium text-neutral-700">{formatCurrency(projectedMonth)}</strong>
              </p>
            ) : undefined
          }
        />
        <SpendingLimitCard
          title="Limite anual"
          icon={CalendarDays}
          spent={spentYear}
          limit={spendingLimits.annual}
          onEditLimit={() => setEditingLimit('annual')}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4 lg:px-6">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold text-neutral-900">Itens previstos do dia</h2>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-neutral-400">
              <ListChecks size={13} /> Referência de planejamento — não é um lançamento real
            </span>
          </div>
          <Button size="sm" onClick={openNewItem}>
            <Plus size={15} /> Novo item
          </Button>
        </div>

        <div className="p-5 pt-0 lg:p-6 lg:pt-0">
          {plannedItems.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nenhum item previsto"
              description="Cadastre itens de referência (ex.: passagem, lanche) para planejar seu gasto do dia — sem virar lançamento real."
              actionLabel="+ Novo item"
              onAction={openNewItem}
            />
          ) : (
            <>
              <ul className="divide-y divide-[var(--border-hairline)]">
                {plannedItems.map((item) => (
                  <li key={item.id} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-neutral-800">{item.name}</p>
                      <p className="text-[12px] text-neutral-500">
                        {item.quantity}x {formatCurrency(item.unitValue)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
                      {formatCurrency(item.quantity * item.unitValue)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEditItem(item)}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-rose-700"
                        aria-label="Editar item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-[var(--color-status-critical-bg)] hover:text-[var(--color-status-critical)]"
                        aria-label="Excluir item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3">
                <span className="text-[13px] text-neutral-500">Total previsto</span>
                <span className="font-display text-[15px] font-semibold text-neutral-900">{formatCurrency(totalPrevisto)}</span>
              </div>
            </>
          )}
        </div>
      </Card>

      <SpendingLimitModal
        open={editingLimit !== null}
        onClose={() => setEditingLimit(null)}
        onSubmit={handleSubmitLimit}
        title={editingLimit ? limitMeta[editingLimit].title : ''}
        currentValue={editingLimit ? spendingLimits[editingLimit] : undefined}
      />

      <PlannedItemFormModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        onSubmit={handleSubmitItem}
        onDelete={
          editingItem
            ? () => {
                setItemModalOpen(false)
                handleDeleteItem(editingItem)
              }
            : undefined
        }
        item={editingItem}
      />
    </div>
  )
}
