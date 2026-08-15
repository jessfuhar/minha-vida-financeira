import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import type {
  Account,
  Transaction,
  CostCenter,
  Category,
  Bill,
  Goal,
  GoalContribution,
  SpendingLimits,
  PlannedItem,
  Profile,
  ClassificationRule,
  DashboardLayout,
} from '../db/models'
import {
  getAll,
  putItem,
  deleteItem,
  generateId,
  isPersistent,
  loadProfile,
  saveProfile,
  loadSpendingLimits,
  saveSpendingLimits,
  loadDashboardLayout,
  saveDashboardLayout,
} from '../db/storage'
import { accountBalanceNow, totalBalanceNow, monthTotals, monthKey, todayIso, daysUntil } from '../lib/aggregations'
import { isInternalTransferKind } from '../lib/transactionKind'
import { normalizeCounterpartyKey, sanitizeCounterpartyForRule } from '../lib/importCounterparty'
import { groupByNormalizedCounterparty } from '../lib/importRules'
import { validateTransferPair } from '../lib/transferDetection'
import { brand } from '../config/brand'
import type { AttentionAlert } from '../data/types'

type NewAccount = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Transaction['status'] }
type NewCostCenter = Omit<CostCenter, 'id' | 'createdAt' | 'updatedAt' | 'categories'>
type NewBill = Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Bill['status'] }
type NewGoal = Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'saved'>
type NewGoalContribution = Omit<GoalContribution, 'id' | 'createdAt' | 'updatedAt'>
type NewPlannedItem = Omit<PlannedItem, 'id' | 'createdAt' | 'updatedAt'>

/** Ordem/visibilidade padrão do painel inicial — usada tanto no primeiro carregamento quanto em
 * "Restaurar organização padrão" (Configurações → Personalizar painel). */
const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  order: ['stats', 'accounts', 'cashflow', 'attention', 'goal', 'favoriteCostCenters', 'recentTransactions'],
  hidden: [],
  favoriteCostCenterIds: [],
}

function computeTransactionStatus(input: {
  kind: Transaction['kind']
  costCenterId: string | null
  categoryId: string | null
}): Transaction['status'] {
  // Transferências entre contas próprias não precisam de categoria — nunca ficam "aguardando classificação".
  if (isInternalTransferKind(input.kind)) return 'classificado'
  return input.costCenterId && input.categoryId ? 'classificado' : 'aguardando_classificacao'
}

interface DataContextValue {
  loading: boolean
  persistent: boolean

  accounts: Account[]
  transactions: Transaction[]
  costCenters: CostCenter[]
  bills: Bill[]
  goals: Goal[]
  goalContributions: GoalContribution[]
  plannedItems: PlannedItem[]
  spendingLimits: SpendingLimits
  profile: Profile
  classificationRules: ClassificationRule[]
  dashboardLayout: DashboardLayout

  addAccount: (input: NewAccount) => Promise<Account>
  updateAccount: (id: string, patch: Partial<NewAccount>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addTransaction: (input: NewTransaction) => Promise<Transaction>
  addTransactionsBatch: (inputs: NewTransaction[]) => Promise<Transaction[]>
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  bulkUpdateTransactions: (ids: string[], patch: Partial<NewTransaction>) => Promise<void>
  bulkDeleteTransactions: (ids: string[]) => Promise<void>

  // ---------- Transferências entre contas próprias ----------
  createTransfer: (input: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date: string
    note?: string
  }) => Promise<{ txOut: Transaction; txIn: Transaction }>
  updateTransferAmount: (transferId: string, newAmount: number) => Promise<void>
  deleteTransferBoth: (transferId: string) => Promise<void>
  unlinkTransfer: (transferId: string) => Promise<void>
  linkAsTransfer: (idA: string, idB: string) => Promise<{ ok: boolean; reason?: string }>

  // ---------- Regras de classificação aprendidas ----------
  saveClassificationRule: (input: { counterparty: string; categoryId: string | null; costCenterId: string | null }) => Promise<void>
  updateClassificationRule: (id: string, patch: Partial<Pick<ClassificationRule, 'categoryId' | 'costCenterId' | 'active' | 'label'>>) => Promise<void>
  deleteClassificationRule: (id: string) => Promise<void>
  registerRuleUsage: (id: string) => void

  addCostCenter: (input: NewCostCenter) => Promise<CostCenter>
  updateCostCenter: (id: string, patch: Partial<Pick<CostCenter, 'name' | 'emoji' | 'color'>>) => Promise<void>
  deleteCostCenter: (id: string) => Promise<void>
  addCategory: (costCenterId: string, name: string) => Promise<Category>
  renameCategory: (costCenterId: string, categoryId: string, name: string) => Promise<void>
  deleteCategory: (costCenterId: string, categoryId: string) => Promise<void>

  addBill: (input: NewBill) => Promise<Bill>
  updateBill: (id: string, patch: Partial<NewBill>) => Promise<void>
  deleteBill: (id: string) => Promise<void>
  bulkUpdateBills: (ids: string[], patch: Partial<NewBill>) => Promise<void>
  bulkDeleteBills: (ids: string[]) => Promise<void>
  markBillPaid: (id: string, opts: { createTransaction: boolean; accountId?: string; date?: string }) => Promise<void>

  addGoal: (input: NewGoal) => Promise<Goal>
  updateGoal: (id: string, patch: Partial<NewGoal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>

  addGoalContribution: (input: NewGoalContribution) => Promise<GoalContribution>
  updateGoalContribution: (id: string, patch: Partial<NewGoalContribution>) => Promise<void>
  deleteGoalContribution: (id: string) => Promise<void>
  goalSaved: (goalId: string) => number

  addPlannedItem: (input: NewPlannedItem) => Promise<PlannedItem>
  updatePlannedItem: (id: string, patch: Partial<NewPlannedItem>) => Promise<void>
  deletePlannedItem: (id: string) => Promise<void>

  updateSpendingLimits: (patch: Partial<SpendingLimits>) => void

  updateProfile: (patch: Partial<Profile>) => void

  updateDashboardLayout: (patch: Partial<DashboardLayout>) => void
  toggleFavoriteCostCenter: (costCenterId: string) => void
  resetDashboardLayout: () => void

  accountBalance: (accountId: string) => number
  totalBalance: number
  monthSummary: { entradas: number; saidas: number; resultado: number }
  recentTransactions: Transaction[]
  alerts: AttentionAlert[]
}

const DataContext = createContext<DataContextValue | null>(null)

function now() {
  return new Date().toISOString()
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [persistent, setPersistent] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactionsState] = useState<Transaction[]>([])
  // Espelha `transactions` de forma síncrona (sem esperar o próximo render). Necessário porque
  // algumas operações encadeadas na mesma função (ex.: importar e, em seguida, vincular como
  // transferência as linhas recém-criadas) leem o estado mais atual antes que o React tenha
  // processado o re-render — sem isso, a busca por id do registro recém-criado falhava
  // silenciosamente por depender de um `transactions` ainda desatualizado (closure stale).
  const transactionsRef = useRef<Transaction[]>([])
  const setTransactions = (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
    setTransactionsState((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: Transaction[]) => Transaction[])(prev) : updater
      transactionsRef.current = next
      return next
    })
  }
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([])
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([])
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimits>(() => loadSpendingLimits<SpendingLimits>({}))
  const [profile, setProfile] = useState<Profile>(() => loadProfile<Profile>({ name: brand.userName }))
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>(() =>
    loadDashboardLayout<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT),
  )
  const [classificationRules, setClassificationRules] = useState<ClassificationRule[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [acc, tx, cc, bl, gl, gc, pi, cr] = await Promise.all([
        getAll<Account>('accounts'),
        getAll<Transaction>('transactions'),
        getAll<CostCenter>('costCenters'),
        getAll<Bill>('bills'),
        getAll<Goal>('goals'),
        getAll<GoalContribution>('goalContributions'),
        getAll<PlannedItem>('plannedItems'),
        getAll<ClassificationRule>('classificationRules'),
      ])
      if (cancelled) return

      // Migração única: metas antigas (fase 2) guardavam o valor reservado
      // diretamente em `goal.saved`. A partir de agora esse valor é sempre a
      // soma dos aportes — então, na primeira carga, viramos o valor legado
      // num aporte inicial e limpamos o campo para não migrar de novo.
      let migratedContributions = gc
      let migratedGoals = gl
      const goalsNeedingMigration = gl.filter(
        (g) => typeof g.saved === 'number' && g.saved > 0 && !gc.some((c) => c.goalId === g.id),
      )
      if (goalsNeedingMigration.length > 0) {
        const newContributions: GoalContribution[] = []
        const updatedGoals: Goal[] = []
        for (const g of goalsNeedingMigration) {
          const contribution: GoalContribution = {
            id: generateId(),
            goalId: g.id,
            amount: g.saved as number,
            date: g.createdAt.slice(0, 10),
            note: 'Saldo inicial migrado',
            createdAt: now(),
            updatedAt: now(),
          }
          newContributions.push(contribution)
          updatedGoals.push({ ...g, saved: undefined, updatedAt: now() })
        }
        await Promise.all([
          ...newContributions.map((c) => putItem('goalContributions', c)),
          ...updatedGoals.map((g) => putItem('goals', g)),
        ])
        migratedContributions = [...gc, ...newContributions]
        migratedGoals = gl.map((g) => updatedGoals.find((u) => u.id === g.id) ?? g)
      }

      setAccounts(acc)
      setTransactions(tx)
      setCostCenters(cc)
      setBills(bl)
      setGoals(migratedGoals)
      setGoalContributions(migratedContributions)
      setPlannedItems(pi)
      setClassificationRules(cr)
      setPersistent(isPersistent())
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- Accounts ----------
  const addAccount = useCallback(async (input: NewAccount) => {
    const account: Account = { ...input, id: generateId(), createdAt: now(), updatedAt: now() }
    await putItem('accounts', account)
    setAccounts((prev) => [...prev, account])
    return account
  }, [])

  const updateAccount = useCallback(
    async (id: string, patch: Partial<NewAccount>) => {
      const existing = accounts.find((a) => a.id === id)
      if (!existing) return
      const updated: Account = { ...existing, ...patch, updatedAt: now() }
      await putItem('accounts', updated)
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)))
    },
    [accounts],
  )

  const deleteAccount = useCallback(
    async (id: string) => {
      const linkedTx = transactions.filter((t) => t.accountId === id)
      await Promise.all(linkedTx.map((t) => deleteItem('transactions', t.id)))
      const affectedBills = bills.filter((b) => b.accountId === id)
      await Promise.all(
        affectedBills.map((b) => putItem('bills', { ...b, accountId: null, updatedAt: now() })),
      )
      const affectedGoals = goals.filter((g) => g.sourceAccountId === id)
      await Promise.all(
        affectedGoals.map((g) => putItem('goals', { ...g, sourceAccountId: null, updatedAt: now() })),
      )
      await deleteItem('accounts', id)
      setTransactions((prev) => prev.filter((t) => t.accountId !== id))
      setBills((prev) => prev.map((b) => (b.accountId === id ? { ...b, accountId: null } : b)))
      setGoals((prev) => prev.map((g) => (g.sourceAccountId === id ? { ...g, sourceAccountId: null } : g)))
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    },
    [transactions, bills, goals],
  )

  // ---------- Transactions ----------
  const addTransaction = useCallback(async (input: NewTransaction) => {
    const transaction: Transaction = {
      ...input,
      source: input.source ?? 'manual',
      status: input.status ?? computeTransactionStatus(input),
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    }
    await putItem('transactions', transaction)
    setTransactions((prev) => [...prev, transaction])
    return transaction
  }, [])

  /** Inserção em lote (usada pela importação de extratos) — grava tudo no IndexedDB e
   * atualiza o estado numa única passada, em vez de uma chamada `addTransaction` por linha. */
  const addTransactionsBatch = useCallback(async (inputs: NewTransaction[]) => {
    const created: Transaction[] = inputs.map((input) => ({
      ...input,
      source: input.source ?? 'importado',
      status: input.status ?? computeTransactionStatus(input),
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    }))
    await Promise.all(created.map((t) => putItem('transactions', t)))
    setTransactions((prev) => [...prev, ...created])
    return created
  }, [])

  // ---------- Regras de classificação aprendidas ----------
  // Nunca usa data, hora, valor ou documento/identificador variável (FITID etc.) como identidade da
  // regra — `sanitizeCounterpartyForRule` limpa o texto bruto e `normalizeCounterpartyKey` normaliza
  // o que sobra (ver lib/importCounterparty.ts). Isso vale tanto para a chave de correspondência
  // (`pattern`) quanto para o texto exibido nas telas (`label`).
  const saveClassificationRule = useCallback(
    async (input: { counterparty: string; categoryId: string | null; costCenterId: string | null }) => {
      const cleanCounterparty = sanitizeCounterpartyForRule(input.counterparty)
      if (!cleanCounterparty) return
      const pattern = normalizeCounterpartyKey(cleanCounterparty)
      if (!pattern) return
      const existing = classificationRules.find((r) => r.pattern === pattern)
      if (existing) {
        const updated: ClassificationRule = {
          ...existing,
          categoryId: input.categoryId,
          costCenterId: input.costCenterId,
          active: true,
          updatedAt: now(),
        }
        await putItem('classificationRules', updated)
        setClassificationRules((prev) => prev.map((r) => (r.id === existing.id ? updated : r)))
      } else {
        const rule: ClassificationRule = {
          id: generateId(),
          pattern,
          label: cleanCounterparty,
          categoryId: input.categoryId,
          costCenterId: input.costCenterId,
          active: true,
          createdAt: now(),
          updatedAt: now(),
          useCount: 0,
        }
        await putItem('classificationRules', rule)
        setClassificationRules((prev) => [...prev, rule])
      }
    },
    [classificationRules],
  )

  const updateClassificationRule = useCallback(
    async (id: string, patch: Partial<Pick<ClassificationRule, 'categoryId' | 'costCenterId' | 'active' | 'label'>>) => {
      const existing = classificationRules.find((r) => r.id === id)
      if (!existing) return
      const updated: ClassificationRule = { ...existing, ...patch, updatedAt: now() }
      await putItem('classificationRules', updated)
      setClassificationRules((prev) => prev.map((r) => (r.id === id ? updated : r)))
    },
    [classificationRules],
  )

  const deleteClassificationRule = useCallback(
    async (id: string) => {
      await deleteItem('classificationRules', id)
      setClassificationRules((prev) => prev.filter((r) => r.id !== id))
    },
    [classificationRules],
  )

  /** Marca que uma regra acabou de ser aplicada (usada na importação) — atualiza contagem de uso
   * e data da última utilização, sem bloquear a importação em si (fire-and-forget). */
  const registerRuleUsage = useCallback(
    (id: string) => {
      const existing = classificationRules.find((r) => r.id === id)
      if (!existing) return
      const updated: ClassificationRule = { ...existing, useCount: existing.useCount + 1, lastUsedAt: now() }
      setClassificationRules((prev) => prev.map((r) => (r.id === id ? updated : r)))
      void putItem('classificationRules', updated)
    },
    [classificationRules],
  )

  /** Aprendizado imediato: toda vez que uma classificação manual define um Centro de Custo, a
   * contraparte (já normalizada) passa a ter regra salva — sem exigir nenhuma ação extra da usuária.
   * A regra nunca CLASSIFICA sozinha lançamentos existentes: ela só passa a alimentar a sugestão
   * (`suggestClassification`, ver lib/importRules.ts) que a usuária aplica manualmente. */
  const updateTransaction = useCallback(
    async (id: string, patch: Partial<NewTransaction>) => {
      const existing = transactions.find((t) => t.id === id)
      if (!existing) return
      const merged = { ...existing, ...patch }
      const updated: Transaction = {
        ...merged,
        status: computeTransactionStatus(merged),
        updatedAt: now(),
      }
      await putItem('transactions', updated)
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
      if (patch.costCenterId) {
        await saveClassificationRule({ counterparty: merged.counterparty ?? '', categoryId: merged.categoryId ?? null, costCenterId: patch.costCenterId })
      }
    },
    [transactions, saveClassificationRule],
  )

  /** Restaura o `kind` original (e desfaz o vínculo) de uma ponta de transferência que ficou
   * "órfã" — usado quando a outra ponta é excluída, para nunca deixar um `transferId` pendurado. */
  const restoreOrphanedTransferPartner = (t: Transaction): Transaction => ({
    ...t,
    kind: t.preTransferKind ?? 'outros',
    transferId: undefined,
    preTransferKind: undefined,
    status: computeTransactionStatus({ kind: t.preTransferKind ?? 'outros', costCenterId: t.costCenterId, categoryId: t.categoryId }),
    updatedAt: now(),
  })

  const deleteTransaction = useCallback(
    async (id: string) => {
      const existing = transactions.find((t) => t.id === id)
      await deleteItem('transactions', id)
      let restoredPartner: Transaction | null = null
      if (existing?.transferId) {
        const partner = transactions.find((t) => t.transferId === existing.transferId && t.id !== id)
        if (partner) {
          restoredPartner = restoreOrphanedTransferPartner(partner)
          await putItem('transactions', restoredPartner)
        }
      }
      setTransactions((prev) =>
        prev.filter((t) => t.id !== id).map((t) => (restoredPartner && t.id === restoredPartner.id ? restoredPartner : t)),
      )
    },
    [transactions],
  )

  /** Atualização em massa — uma única passada de gravação + atualização de estado, em vez de uma
   * chamada por lançamento (importante ao classificar/mover centenas de lançamentos de uma vez). */
  const bulkUpdateTransactions = useCallback(
    async (ids: string[], patch: Partial<NewTransaction>) => {
      const idSet = new Set(ids)
      const updated: Transaction[] = []
      for (const t of transactions) {
        if (!idSet.has(t.id)) continue
        const merged = { ...t, ...patch }
        updated.push({ ...merged, status: computeTransactionStatus(merged), updatedAt: now() })
      }
      await Promise.all(updated.map((u) => putItem('transactions', u)))
      const byId = new Map(updated.map((u) => [u.id, u]))
      setTransactions((prev) => prev.map((t) => byId.get(t.id) ?? t))

      // Mesmo aprendizado imediato de updateTransaction, mas por contraparte distinta dentro do lote
      // — nunca uma regra só para a primeira transação selecionada.
      if (patch.costCenterId) {
        const groups = groupByNormalizedCounterparty(updated, (t) => t.counterparty)
        for (const group of groups.values()) {
          const counterparty = group[0].counterparty
          if (!counterparty) continue
          await saveClassificationRule({ counterparty, categoryId: patch.categoryId ?? null, costCenterId: patch.costCenterId })
        }
      }
    },
    [transactions, saveClassificationRule],
  )

  /** Exclusão em massa — também restaura (desvincula) automaticamente qualquer ponta de
   * transferência cujo par foi excluído nesta mesma operação, para nunca deixar vínculo quebrado. */
  const bulkDeleteTransactions = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids)
      const toDelete = transactions.filter((t) => idSet.has(t.id))
      const affectedTransferIds = new Set(toDelete.filter((t) => t.transferId).map((t) => t.transferId as string))
      const orphanedPartners = transactions.filter(
        (t) => t.transferId && affectedTransferIds.has(t.transferId) && !idSet.has(t.id),
      )
      const restoredPartners = orphanedPartners.map(restoreOrphanedTransferPartner)
      await Promise.all([
        ...ids.map((id) => deleteItem('transactions', id)),
        ...restoredPartners.map((t) => putItem('transactions', t)),
      ])
      const restoredById = new Map(restoredPartners.map((t) => [t.id, t]))
      setTransactions((prev) => prev.filter((t) => !idSet.has(t.id)).map((t) => restoredById.get(t.id) ?? t))
    },
    [transactions],
  )

  // ---------- Transferências entre contas próprias ----------
  const createTransfer = useCallback(
    async (input: { fromAccountId: string; toAccountId: string; amount: number; date: string; note?: string }) => {
      const transferId = generateId()
      const fromAcc = accounts.find((a) => a.id === input.fromAccountId)
      const toAcc = accounts.find((a) => a.id === input.toAccountId)
      const fromLabel = fromAcc ? fromAcc.nickname || fromAcc.bank : 'conta de origem'
      const toLabel = toAcc ? toAcc.nickname || toAcc.bank : 'conta de destino'
      const txOut = await addTransaction({
        date: input.date,
        description: `Transferência para ${toLabel}`,
        kind: 'transferencia_interna',
        direction: 'saida',
        amount: input.amount,
        accountId: input.fromAccountId,
        costCenterId: null,
        categoryId: null,
        note: input.note,
        status: 'classificado',
        transferId,
      })
      const txIn = await addTransaction({
        date: input.date,
        description: `Transferência de ${fromLabel}`,
        kind: 'transferencia_interna',
        direction: 'entrada',
        amount: input.amount,
        accountId: input.toAccountId,
        costCenterId: null,
        categoryId: null,
        note: input.note,
        status: 'classificado',
        transferId,
      })
      return { txOut, txIn }
    },
    [accounts, addTransaction],
  )

  const updateTransferAmount = useCallback(
    async (transferId: string, newAmount: number) => {
      const pair = transactions.filter((t) => t.transferId === transferId)
      const updated = pair.map((t) => ({ ...t, amount: newAmount, updatedAt: now() }))
      await Promise.all(updated.map((u) => putItem('transactions', u)))
      const byId = new Map(updated.map((u) => [u.id, u]))
      setTransactions((prev) => prev.map((t) => byId.get(t.id) ?? t))
    },
    [transactions],
  )

  const deleteTransferBoth = useCallback(
    async (transferId: string) => {
      const ids = transactions.filter((t) => t.transferId === transferId).map((t) => t.id)
      await bulkDeleteTransactions(ids)
    },
    [transactions, bulkDeleteTransactions],
  )

  const unlinkTransfer = useCallback(
    async (transferId: string) => {
      const pair = transactions.filter((t) => t.transferId === transferId)
      const updated = pair.map(restoreOrphanedTransferPartner)
      await Promise.all(updated.map((u) => putItem('transactions', u)))
      const byId = new Map(updated.map((u) => [u.id, u]))
      setTransactions((prev) => prev.map((t) => byId.get(t.id) ?? t))
    },
    [transactions],
  )

  const linkAsTransfer = useCallback(
    async (idA: string, idB: string) => {
      // Lê do ref (sempre atualizado de forma síncrona) em vez do `transactions` fechado nesta
      // closure — importante quando esta função é chamada logo após uma importação, na mesma
      // operação, antes de o React repropagar o novo `transactions` para um re-render.
      const a = transactionsRef.current.find((t) => t.id === idA)
      const b = transactionsRef.current.find((t) => t.id === idB)
      if (!a || !b) return { ok: false, reason: 'Lançamento não encontrado.' }
      const validation = validateTransferPair(a, b)
      if (!validation.valid) return { ok: false, reason: validation.reason }
      const transferId = generateId()
      const updatedA: Transaction = {
        ...a,
        transferId,
        preTransferKind: a.kind,
        kind: 'transferencia_interna',
        costCenterId: null,
        categoryId: null,
        status: 'classificado',
        updatedAt: now(),
      }
      const updatedB: Transaction = {
        ...b,
        transferId,
        preTransferKind: b.kind,
        kind: 'transferencia_interna',
        costCenterId: null,
        categoryId: null,
        status: 'classificado',
        updatedAt: now(),
      }
      await Promise.all([putItem('transactions', updatedA), putItem('transactions', updatedB)])
      setTransactions((prev) => prev.map((t) => (t.id === idA ? updatedA : t.id === idB ? updatedB : t)))
      return { ok: true }
    },
    [transactions],
  )

  // ---------- Cost centers & categories ----------
  const addCostCenter = useCallback(async (input: NewCostCenter) => {
    const costCenter: CostCenter = { ...input, categories: [], id: generateId(), createdAt: now(), updatedAt: now() }
    await putItem('costCenters', costCenter)
    setCostCenters((prev) => [...prev, costCenter])
    return costCenter
  }, [])

  const updateCostCenter = useCallback(
    async (id: string, patch: Partial<Pick<CostCenter, 'name' | 'emoji' | 'color'>>) => {
      const existing = costCenters.find((c) => c.id === id)
      if (!existing) return
      const updated: CostCenter = { ...existing, ...patch, updatedAt: now() }
      await putItem('costCenters', updated)
      setCostCenters((prev) => prev.map((c) => (c.id === id ? updated : c)))
    },
    [costCenters],
  )

  const deleteCostCenter = useCallback(
    async (id: string) => {
      const affectedTx = transactions.filter((t) => t.costCenterId === id)
      await Promise.all(
        affectedTx.map((t) => putItem('transactions', { ...t, costCenterId: null, categoryId: null, status: 'aguardando_classificacao' as const, updatedAt: now() })),
      )
      const affectedBills = bills.filter((b) => b.costCenterId === id)
      await Promise.all(
        affectedBills.map((b) => putItem('bills', { ...b, costCenterId: null, categoryId: null, updatedAt: now() })),
      )
      await deleteItem('costCenters', id)
      setTransactions((prev) =>
        prev.map((t) => (t.costCenterId === id ? { ...t, costCenterId: null, categoryId: null, status: 'aguardando_classificacao' } : t)),
      )
      setBills((prev) => prev.map((b) => (b.costCenterId === id ? { ...b, costCenterId: null, categoryId: null } : b)))
      setCostCenters((prev) => prev.filter((c) => c.id !== id))
    },
    [transactions, bills],
  )

  const addCategory = useCallback(
    async (costCenterId: string, name: string) => {
      const cc = costCenters.find((c) => c.id === costCenterId)
      if (!cc) throw new Error('Centro de custo não encontrado')
      const category: Category = { id: generateId(), name }
      const updated: CostCenter = { ...cc, categories: [...cc.categories, category], updatedAt: now() }
      await putItem('costCenters', updated)
      setCostCenters((prev) => prev.map((c) => (c.id === costCenterId ? updated : c)))
      return category
    },
    [costCenters],
  )

  const renameCategory = useCallback(
    async (costCenterId: string, categoryId: string, name: string) => {
      const cc = costCenters.find((c) => c.id === costCenterId)
      if (!cc) return
      const updated: CostCenter = {
        ...cc,
        categories: cc.categories.map((cat) => (cat.id === categoryId ? { ...cat, name } : cat)),
        updatedAt: now(),
      }
      await putItem('costCenters', updated)
      setCostCenters((prev) => prev.map((c) => (c.id === costCenterId ? updated : c)))
    },
    [costCenters],
  )

  const deleteCategory = useCallback(
    async (costCenterId: string, categoryId: string) => {
      const cc = costCenters.find((c) => c.id === costCenterId)
      if (!cc) return
      const updated: CostCenter = {
        ...cc,
        categories: cc.categories.filter((cat) => cat.id !== categoryId),
        updatedAt: now(),
      }
      await putItem('costCenters', updated)
      const affectedTx = transactions.filter((t) => t.categoryId === categoryId)
      await Promise.all(
        affectedTx.map((t) => putItem('transactions', { ...t, categoryId: null, status: 'aguardando_classificacao' as const, updatedAt: now() })),
      )
      const affectedBills = bills.filter((b) => b.categoryId === categoryId)
      await Promise.all(affectedBills.map((b) => putItem('bills', { ...b, categoryId: null, updatedAt: now() })))
      setCostCenters((prev) => prev.map((c) => (c.id === costCenterId ? updated : c)))
      setTransactions((prev) => prev.map((t) => (t.categoryId === categoryId ? { ...t, categoryId: null, status: 'aguardando_classificacao' } : t)))
      setBills((prev) => prev.map((b) => (b.categoryId === categoryId ? { ...b, categoryId: null } : b)))
    },
    [costCenters, transactions, bills],
  )

  // ---------- Bills ----------
  const addBill = useCallback(async (input: NewBill) => {
    const bill: Bill = { ...input, status: input.status ?? 'pendente', id: generateId(), createdAt: now(), updatedAt: now() }
    await putItem('bills', bill)
    setBills((prev) => [...prev, bill])
    return bill
  }, [])

  const updateBill = useCallback(
    async (id: string, patch: Partial<NewBill>) => {
      const existing = bills.find((b) => b.id === id)
      if (!existing) return
      const updated: Bill = { ...existing, ...patch, updatedAt: now() }
      await putItem('bills', updated)
      setBills((prev) => prev.map((b) => (b.id === id ? updated : b)))
    },
    [bills],
  )

  const deleteBill = useCallback(async (id: string) => {
    await deleteItem('bills', id)
    setBills((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const bulkUpdateBills = useCallback(
    async (ids: string[], patch: Partial<NewBill>) => {
      const idSet = new Set(ids)
      const updated: Bill[] = []
      for (const b of bills) {
        if (!idSet.has(b.id)) continue
        updated.push({ ...b, ...patch, updatedAt: now() })
      }
      await Promise.all(updated.map((u) => putItem('bills', u)))
      const byId = new Map(updated.map((u) => [u.id, u]))
      setBills((prev) => prev.map((b) => byId.get(b.id) ?? b))
    },
    [bills],
  )

  const bulkDeleteBills = useCallback(async (ids: string[]) => {
    const idSet = new Set(ids)
    await Promise.all(ids.map((id) => deleteItem('bills', id)))
    setBills((prev) => prev.filter((b) => !idSet.has(b.id)))
  }, [])

  const markBillPaid = useCallback(
    async (id: string, opts: { createTransaction: boolean; accountId?: string; date?: string }) => {
      const bill = bills.find((b) => b.id === id)
      if (!bill) return
      let transactionId: string | undefined
      if (opts.createTransaction && !bill.transactionId) {
        const accountId = opts.accountId ?? bill.accountId
        if (accountId) {
          const tx = await addTransaction({
            date: opts.date ?? todayIso(),
            description: bill.name,
            originalDescription: bill.originalDescription,
            kind: 'boleto',
            direction: 'saida',
            amount: bill.amount,
            accountId,
            costCenterId: bill.costCenterId,
            categoryId: bill.categoryId,
            billId: bill.id,
          })
          transactionId = tx.id
        }
      }
      const updated: Bill = { ...bill, status: 'paga', paidAt: opts.date ?? todayIso(), transactionId: transactionId ?? bill.transactionId, updatedAt: now() }
      await putItem('bills', updated)
      setBills((prev) => prev.map((b) => (b.id === id ? updated : b)))
    },
    [bills, addTransaction],
  )

  // ---------- Goals ----------
  const addGoal = useCallback(async (input: NewGoal) => {
    const goal: Goal = { ...input, id: generateId(), createdAt: now(), updatedAt: now() }
    await putItem('goals', goal)
    setGoals((prev) => [...prev, goal])
    return goal
  }, [])

  const updateGoal = useCallback(
    async (id: string, patch: Partial<NewGoal>) => {
      const existing = goals.find((g) => g.id === id)
      if (!existing) return
      const updated: Goal = { ...existing, ...patch, updatedAt: now() }
      await putItem('goals', updated)
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)))
    },
    [goals],
  )

  const deleteGoal = useCallback(
    async (id: string) => {
      const linkedContributions = goalContributions.filter((c) => c.goalId === id)
      await Promise.all(linkedContributions.map((c) => deleteItem('goalContributions', c.id)))
      await deleteItem('goals', id)
      setGoalContributions((prev) => prev.filter((c) => c.goalId !== id))
      setGoals((prev) => prev.filter((g) => g.id !== id))
    },
    [goalContributions],
  )

  // ---------- Aportes do cofrinho ----------
  const addGoalContribution = useCallback(async (input: NewGoalContribution) => {
    const contribution: GoalContribution = { ...input, id: generateId(), createdAt: now(), updatedAt: now() }
    await putItem('goalContributions', contribution)
    setGoalContributions((prev) => [...prev, contribution])
    return contribution
  }, [])

  const updateGoalContribution = useCallback(
    async (id: string, patch: Partial<NewGoalContribution>) => {
      const existing = goalContributions.find((c) => c.id === id)
      if (!existing) return
      const updated: GoalContribution = { ...existing, ...patch, updatedAt: now() }
      await putItem('goalContributions', updated)
      setGoalContributions((prev) => prev.map((c) => (c.id === id ? updated : c)))
    },
    [goalContributions],
  )

  const deleteGoalContribution = useCallback(async (id: string) => {
    await deleteItem('goalContributions', id)
    setGoalContributions((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const goalSaved = useCallback(
    (goalId: string) => goalContributions.filter((c) => c.goalId === goalId).reduce((sum, c) => sum + c.amount, 0),
    [goalContributions],
  )

  // ---------- Itens previstos (orçamento diário) ----------
  const addPlannedItem = useCallback(async (input: NewPlannedItem) => {
    const item: PlannedItem = { ...input, id: generateId(), createdAt: now(), updatedAt: now() }
    await putItem('plannedItems', item)
    setPlannedItems((prev) => [...prev, item])
    return item
  }, [])

  const updatePlannedItem = useCallback(
    async (id: string, patch: Partial<NewPlannedItem>) => {
      const existing = plannedItems.find((i) => i.id === id)
      if (!existing) return
      const updated: PlannedItem = { ...existing, ...patch, updatedAt: now() }
      await putItem('plannedItems', updated)
      setPlannedItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
    },
    [plannedItems],
  )

  const deletePlannedItem = useCallback(async (id: string) => {
    await deleteItem('plannedItems', id)
    setPlannedItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  // ---------- Limites de gasto ----------
  const updateSpendingLimits = useCallback((patch: Partial<SpendingLimits>) => {
    setSpendingLimits((prev) => {
      const updated = { ...prev, ...patch }
      saveSpendingLimits(updated)
      return updated
    })
  }, [])

  // ---------- Profile ----------
  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...patch }
      saveProfile(updated)
      return updated
    })
  }, [])

  // ---------- Personalização do painel (Configurações → Personalizar painel + "Organizar painel") ----------
  const updateDashboardLayout = useCallback((patch: Partial<DashboardLayout>) => {
    setDashboardLayout((prev) => {
      const updated = { ...prev, ...patch }
      saveDashboardLayout(updated)
      return updated
    })
  }, [])

  const toggleFavoriteCostCenter = useCallback((costCenterId: string) => {
    setDashboardLayout((prev) => {
      const isFavorite = prev.favoriteCostCenterIds.includes(costCenterId)
      const favoriteCostCenterIds = isFavorite
        ? prev.favoriteCostCenterIds.filter((id) => id !== costCenterId)
        : [...prev.favoriteCostCenterIds, costCenterId]
      const updated = { ...prev, favoriteCostCenterIds }
      saveDashboardLayout(updated)
      return updated
    })
  }, [])

  const resetDashboardLayout = useCallback(() => {
    setDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)
    saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)
  }, [])

  // ---------- Derived ----------
  const accountBalance = useCallback((accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc) return 0
    return accountBalanceNow(acc, transactions)
  }, [accounts, transactions])

  const totalBalance = useMemo(() => totalBalanceNow(accounts, transactions), [accounts, transactions])

  const monthSummary = useMemo(() => {
    const { entradas, saidas } = monthTotals(transactions, monthKey(todayIso()))
    return { entradas, saidas, resultado: entradas - saidas }
  }, [transactions])

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt))).slice(0, 6),
    [transactions],
  )

  const alerts = useMemo<AttentionAlert[]>(() => {
    const list: AttentionAlert[] = []
    const today = todayIso()

    if (accounts.length === 0) {
      list.push({
        id: 'no-accounts',
        level: 'urgente',
        title: 'Nenhuma conta cadastrada',
        description: 'Cadastre sua primeira conta para começar a acompanhar seu saldo.',
      })
    }

    const overdueBills = bills.filter((b) => b.status === 'pendente' && b.dueDate < today)
    if (overdueBills.length > 0) {
      list.push({
        id: 'overdue-bills',
        level: 'urgente',
        title:
          overdueBills.length === 1
            ? `Conta vencida: ${overdueBills[0].name}`
            : `${overdueBills.length} contas vencidas`,
        description: overdueBills.length === 1 ? `Venceu em ${overdueBills[0].dueDate.split('-').reverse().join('/')}` : undefined,
      })
    }

    const upcomingBills = bills.filter((b) => b.status === 'pendente' && daysUntil(b.dueDate, today) >= 0 && daysUntil(b.dueDate, today) <= 3)
    if (upcomingBills.length > 0) {
      list.push({
        id: 'upcoming-bills',
        level: 'atencao',
        title:
          upcomingBills.length === 1
            ? `${upcomingBills[0].name} vence em breve`
            : `${upcomingBills.length} contas próximas do vencimento`,
        description: 'Vencimento nos próximos 3 dias.',
      })
    }

    const uncategorized = transactions.filter((t) => (!t.costCenterId || !t.categoryId) && !isInternalTransferKind(t.kind))
    if (uncategorized.length > 0) {
      list.push({
        id: 'uncategorized-tx',
        level: 'atencao',
        title: `${uncategorized.length} lançamento${uncategorized.length > 1 ? 's' : ''} aguardando classificação`,
        description: 'Defina centro de custo e categoria para manter os relatórios em dia.',
      })
    }

    const incompleteBills = bills.filter((b) => b.status === 'pendente' && (!b.accountId || !b.costCenterId))
    if (incompleteBills.length > 0) {
      list.push({
        id: 'incomplete-bills',
        level: 'info',
        title: `${incompleteBills.length} conta${incompleteBills.length > 1 ? 's' : ''} a pagar com dados incompletos`,
        description: 'Informe conta bancária e centro de custo para facilitar o pagamento.',
      })
    }

    const order: Record<AttentionAlert['level'], number> = { urgente: 0, atencao: 1, info: 2 }
    return list.sort((a, b) => order[a.level] - order[b.level])
  }, [accounts, bills, transactions])

  const value: DataContextValue = {
    loading,
    persistent,
    accounts,
    transactions,
    costCenters,
    bills,
    goals,
    goalContributions,
    plannedItems,
    spendingLimits,
    profile,
    dashboardLayout,
    classificationRules,
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,
    bulkUpdateTransactions,
    bulkDeleteTransactions,
    createTransfer,
    updateTransferAmount,
    deleteTransferBoth,
    unlinkTransfer,
    linkAsTransfer,
    saveClassificationRule,
    updateClassificationRule,
    deleteClassificationRule,
    registerRuleUsage,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    addCategory,
    renameCategory,
    deleteCategory,
    addBill,
    updateBill,
    deleteBill,
    bulkUpdateBills,
    bulkDeleteBills,
    markBillPaid,
    addGoal,
    updateGoal,
    deleteGoal,
    addGoalContribution,
    updateGoalContribution,
    deleteGoalContribution,
    goalSaved,
    addPlannedItem,
    updatePlannedItem,
    deletePlannedItem,
    updateSpendingLimits,
    updateProfile,
    updateDashboardLayout,
    toggleFavoriteCostCenter,
    resetDashboardLayout,
    accountBalance,
    totalBalance,
    monthSummary,
    recentTransactions,
    alerts,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>')
  return ctx
}
