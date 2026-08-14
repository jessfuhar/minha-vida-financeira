import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { CostCenterFormModal, type CostCenterFormValues } from '../components/costcenters/CostCenterFormModal'
import { CategoryChip } from '../components/costcenters/CategoryChip'
import { CategoryDetailModal } from '../components/costcenters/CategoryDetailModal'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { formatCurrency } from '../lib/format'
import { monthKey, todayIso, nextCostCenterColor } from '../lib/aggregations'
import { Info, Plus, Pencil, Layers } from 'lucide-react'
import type { CostCenter, Category } from '../db/models'

export default function CostCenters() {
  const { costCenters, transactions, accounts, addCostCenter, updateCostCenter, deleteCostCenter, addCategory, renameCategory, deleteCategory } =
    useData()
  const toast = useToast()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostCenter | null>(null)
  const [addingCategoryFor, setAddingCategoryFor] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [detail, setDetail] = useState<{ costCenter: CostCenter; category: Category } | null>(null)

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (cc: CostCenter) => {
    setEditing(cc)
    setModalOpen(true)
  }

  const handleSubmit = async (values: CostCenterFormValues) => {
    if (editing) {
      await updateCostCenter(editing.id, values)
      toast.show('Centro de custo atualizado.')
    } else {
      await addCostCenter({ ...values, color: nextCostCenterColor(costCenters.length) })
      toast.show('Centro de custo criado.')
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    const linked = transactions.filter((t) => t.costCenterId === editing.id).length
    const ok = await confirm({
      title: 'Excluir centro de custo',
      description:
        linked > 0
          ? `${linked} lançamento(s) usam "${editing.name}". Eles ficarão sem centro de custo. Deseja continuar?`
          : `Tem certeza que deseja excluir "${editing.name}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteCostCenter(editing.id)
    setModalOpen(false)
    toast.show('Centro de custo excluído.', 'info')
  }

  const monthlySpend = (costCenterId: string) =>
    transactions
      .filter((t) => t.costCenterId === costCenterId && t.direction === 'saida' && monthKey(t.date) === monthKey(todayIso()))
      .reduce((sum, t) => sum + t.amount, 0)

  const confirmAddCategory = async (costCenterId: string) => {
    const name = newCategoryName.trim()
    if (!name) {
      setAddingCategoryFor(null)
      return
    }
    await addCategory(costCenterId, name)
    setNewCategoryName('')
    setAddingCategoryFor(null)
  }

  const handleDeleteCategory = async (costCenterId: string, categoryId: string, categoryName: string) => {
    const linked = transactions.filter((t) => t.categoryId === categoryId).length
    const ok = await confirm({
      title: 'Excluir categoria',
      description:
        linked > 0
          ? `${linked} lançamento(s) usam "${categoryName}". Eles ficarão sem categoria. Deseja continuar?`
          : `Tem certeza que deseja excluir "${categoryName}"?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteCategory(costCenterId, categoryId)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centros de Custo"
        subtitle="As grandes áreas da sua vida financeira — cada uma reúne várias categorias de gasto."
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> Novo centro de custo
          </Button>
        }
      />

      <Card className="flex items-start gap-3 bg-rose-50/60">
        <Info size={18} className="mt-0.5 shrink-0 text-rose-700" />
        <p className="text-[13.5px] leading-relaxed text-neutral-700">
          <strong className="font-semibold">Centro de custo</strong> não é a mesma coisa que{' '}
          <strong className="font-semibold">categoria</strong>. O centro de custo representa a área geral (ex.: Casa),
          enquanto a categoria representa o tipo específico de gasto dentro dela (ex.: Energia, Internet, Alimentação).
        </p>
      </Card>

      {costCenters.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="Nenhum centro de custo cadastrado"
            description="Crie centros de custo como Casa, Pessoal ou Trabalho para organizar seus gastos."
            actionLabel="+ Novo centro de custo"
            onAction={openNew}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {costCenters.map((cc) => (
            <Card key={cc.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[19px]"
                    style={{ background: `color-mix(in srgb, ${cc.color} 14%, white)` }}
                  >
                    {cc.emoji}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => openEdit(cc)}
                      className="group flex items-center gap-1.5 text-[15px] font-semibold text-neutral-900 hover:text-rose-700"
                    >
                      {cc.name}
                      <Pencil size={12} className="text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                    <p className="text-[12px] text-neutral-500">{cc.categories.length} categorias</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-neutral-500">este mês</p>
                  <p className="text-[14.5px] font-semibold tabular-nums text-neutral-900">
                    {formatCurrency(monthlySpend(cc.id))}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {cc.categories.map((cat) => (
                  <CategoryChip
                    key={cat.id}
                    category={cat}
                    onRename={(name) => renameCategory(cc.id, cat.id, name)}
                    onDelete={() => handleDeleteCategory(cc.id, cat.id, cat.name)}
                    onOpenDetail={() => setDetail({ costCenter: cc, category: cat })}
                  />
                ))}

                {addingCategoryFor === cc.id ? (
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmAddCategory(cc.id)
                      if (e.key === 'Escape') {
                        setAddingCategoryFor(null)
                        setNewCategoryName('')
                      }
                    }}
                    onBlur={() => confirmAddCategory(cc.id)}
                    placeholder="Nome da categoria"
                    className="w-32 rounded-full border border-rose-300 bg-white px-2.5 py-1 text-[12px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategoryFor(cc.id)
                      setNewCategoryName('')
                    }}
                    className="rounded-full border border-dashed border-rose-300 px-2.5 py-1 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
                  >
                    + categoria
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <CostCenterFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        costCenter={editing}
      />

      <CategoryDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        costCenter={detail?.costCenter ?? null}
        category={detail?.category ?? null}
        transactions={transactions}
        accounts={accounts}
      />
    </div>
  )
}
