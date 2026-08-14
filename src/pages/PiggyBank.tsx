import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { GoalFormModal, type GoalFormValues } from '../components/goals/GoalFormModal'
import { GoalContributionModal, type GoalContributionFormValues } from '../components/goals/GoalContributionModal'
import { GoalHistoryModal } from '../components/goals/GoalHistoryModal'
import { GoalProgressMascot } from '../components/goals/GoalProgressMascot'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { formatCurrency, formatDate, formatDateLong, parseCurrencyInput } from '../lib/format'
import { nextGoalColor } from '../lib/aggregations'
import { Plus, Target, Pencil, PiggyBank as PiggyBankIcon, ChevronRight } from 'lucide-react'
import type { Goal, GoalContribution } from '../db/models'

export default function PiggyBank() {
  const {
    goals,
    accounts,
    goalContributions,
    goalSaved,
    addGoal,
    updateGoal,
    deleteGoal,
    addGoalContribution,
    updateGoalContribution,
    deleteGoalContribution,
  } = useData()
  const toast = useToast()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const [contributionModalOpen, setContributionModalOpen] = useState(false)
  const [contributionGoal, setContributionGoal] = useState<Goal | null>(null)
  const [editingContribution, setEditingContribution] = useState<GoalContribution | null>(null)

  const [historyGoal, setHistoryGoal] = useState<Goal | null>(null)

  const totalSaved = goals.reduce((s, g) => s + goalSaved(g.id), 0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (g: Goal) => {
    setEditing(g)
    setModalOpen(true)
  }

  // Permite chegar aqui a partir de um resultado clicável da busca geral (/buscar), já abrindo a
  // meta/cofrinho correspondente — sem navegação quebrada.
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const targetId = (location.state as { openGoalId?: string } | null)?.openGoalId
    if (!targetId) return
    const goal = goals.find((g) => g.id === targetId)
    if (goal) openEdit(goal)
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const handleSubmit = async (values: GoalFormValues) => {
    const payload = {
      name: values.name.trim(),
      emoji: values.emoji.trim() || '🎯',
      target: parseCurrencyInput(values.target),
      sourceAccountId: values.sourceAccountId || null,
      deadline: values.deadline || undefined,
      color: editing?.color ?? nextGoalColor(goals.length),
    }
    if (editing) {
      await updateGoal(editing.id, payload)
      toast.show('Meta atualizada.')
    } else {
      await addGoal(payload)
      toast.show('Meta criada.')
    }
  }

  const handleDelete = async () => {
    if (!editing) return
    const ok = await confirm({
      title: 'Excluir meta',
      description: `Tem certeza que deseja excluir a meta "${editing.name}"? O valor reservado continua nas suas contas normalmente.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteGoal(editing.id)
    setModalOpen(false)
    toast.show('Meta excluída.', 'info')
  }

  const openAddContribution = (goal: Goal) => {
    setContributionGoal(goal)
    setEditingContribution(null)
    setContributionModalOpen(true)
  }
  const openEditContribution = (goal: Goal, contribution: GoalContribution) => {
    setContributionGoal(goal)
    setEditingContribution(contribution)
    setContributionModalOpen(true)
  }

  const handleSubmitContribution = async (values: GoalContributionFormValues) => {
    if (!contributionGoal) return
    const payload = {
      goalId: contributionGoal.id,
      amount: parseCurrencyInput(values.amount),
      date: values.date,
      note: values.note.trim() || undefined,
    }
    if (editingContribution) {
      await updateGoalContribution(editingContribution.id, payload)
      toast.show('Aporte atualizado.')
    } else {
      await addGoalContribution(payload)
      toast.show('Valor adicionado ao cofrinho.')
    }
  }

  const handleDeleteContribution = async (contribution: GoalContribution) => {
    const ok = await confirm({
      title: 'Excluir aporte',
      description: `Excluir o aporte de ${formatCurrency(contribution.amount)} em ${formatDate(contribution.date)}?`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteGoalContribution(contribution.id)
    toast.show('Aporte excluído.', 'info')
  }

  const accountName = (id?: string | null) => {
    if (!id) return null
    const acc = accounts.find((a) => a.id === id)
    return acc ? acc.nickname || acc.bank : null
  }

  const contributionsFor = (goalId: string) =>
    goalContributions
      .filter((c) => c.goalId === goalId)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cofrinho"
        subtitle="Suas metas de economia — guarde um pouco de cada vez até chegar lá."
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> Nova meta
          </Button>
        }
      />

      {goals.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-rose-50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[13px] text-neutral-500">Total reservado em todas as metas</p>
              <p className="font-display text-[20px] font-semibold text-neutral-900">{formatCurrency(totalSaved)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-neutral-500">Meta somada</p>
            <p className="text-[15px] font-semibold text-neutral-700">{formatCurrency(totalTarget)}</p>
          </div>
        </Card>
      )}

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBankIcon}
            title="Nenhuma meta cadastrada"
            description="Crie um cofrinho para reservar dinheiro das suas contas para um objetivo, sem duplicar seu patrimônio."
            actionLabel="+ Nova meta"
            onAction={openNew}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const saved = goalSaved(goal.id)
            const pct = goal.target > 0 ? Math.round((saved / goal.target) * 100) : 0
            const origin = accountName(goal.sourceAccountId)
            const recent = contributionsFor(goal.id).slice(0, 3)
            return (
              <Card key={goal.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[19px]"
                    style={{ background: `color-mix(in srgb, ${goal.color} 14%, white)` }}
                  >
                    {goal.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openEdit(goal)}
                      className="group flex items-center gap-1.5 truncate text-[15px] font-semibold text-neutral-900 hover:text-rose-700"
                    >
                      <span className="truncate">{goal.name}</span>
                      <Pencil size={12} className="shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                    <p className="truncate text-[12px] text-neutral-500">
                      {goal.deadline && <>até {formatDateLong(goal.deadline)}</>}
                      {goal.deadline && origin && ' · '}
                      {origin && <>de {origin}</>}
                    </p>
                  </div>
                  <GoalProgressMascot percent={pct} />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="font-display text-[19px] font-semibold tabular-nums text-neutral-900">
                      {formatCurrency(saved)}
                    </span>
                    <span className="text-[12.5px] text-neutral-500">de {formatCurrency(goal.target)}</span>
                  </div>
                  <ProgressBar value={pct} color={goal.color} height={10} />
                  <div className="mt-1.5 text-[12px] text-neutral-500">{pct}% concluído</div>
                </div>

                {recent.length > 0 && (
                  <div className="space-y-1 border-t border-[var(--border-hairline)] pt-3">
                    {recent.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-[12.5px]">
                        <span className="text-neutral-500">{formatDate(c.date)}</span>
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: c.amount >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)' }}
                        >
                          {c.amount >= 0 ? '+' : ''}
                          {formatCurrency(c.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={() => openAddContribution(goal)} className="flex-1">
                    <Plus size={14} /> Adicionar valor
                  </Button>
                  <button
                    type="button"
                    onClick={() => setHistoryGoal(goal)}
                    className="inline-flex items-center gap-0.5 rounded-lg px-2 py-2 text-[12.5px] font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Ver mais <ChevronRight size={14} />
                  </button>
                </div>
              </Card>
            )
          })}

          <button
            type="button"
            onClick={openNew}
            className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-300 bg-rose-50/40 p-5 text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Plus size={22} />
            <span className="text-[13.5px] font-medium">Criar nova meta</span>
          </button>
        </div>
      )}

      <GoalFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
        accounts={accounts}
        goal={editing}
      />

      <GoalContributionModal
        open={contributionModalOpen}
        onClose={() => setContributionModalOpen(false)}
        onSubmit={handleSubmitContribution}
        onDelete={
          editingContribution
            ? () => {
                setContributionModalOpen(false)
                handleDeleteContribution(editingContribution)
              }
            : undefined
        }
        goalName={contributionGoal?.name ?? ''}
        contribution={editingContribution}
      />

      <GoalHistoryModal
        open={!!historyGoal}
        onClose={() => setHistoryGoal(null)}
        goalName={historyGoal?.name ?? ''}
        contributions={historyGoal ? contributionsFor(historyGoal.id) : []}
        onAdd={() => {
          if (!historyGoal) return
          openAddContribution(historyGoal)
        }}
        onEdit={(c) => {
          if (!historyGoal) return
          openEditContribution(historyGoal, c)
        }}
        onDelete={handleDeleteContribution}
      />
    </div>
  )
}
