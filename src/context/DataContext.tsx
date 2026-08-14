import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
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
} from '../db/storage'
import { accountBalanceNow, totalBalanceNow, monthTotals, monthKey, todayIso, daysUntil } from '../lib/aggregations'
import { brand } from '../config/brand'
import type { AttentionAlert } from '../data/types'

type NewAccount = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Transaction['status'] }
type NewCostCenter = Omit<CostCenter, 'id' | 'createdAt' | 'updatedAt' | 'categories'>
type NewBill = Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Bill['status'] }
type NewGoal = Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'saved'>
type NewGoalContribution = Omit<GoalContribution, 'id' | 'createdAt' | 'updatedAt'>
type NewPlannedItem = Omit<PlannedItem, 'id' | 'createdAt' | 'updatedAt'>

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

  addAccount: (input: NewAccount) => Promise<Account>
  updateAccount: (id: string, patch: Partial<NewAccount>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addTransaction: (input: NewTransaction) => Promise<Transaction>
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  addCostCenter: (input: NewCostCenter) => Promise<CostCenter>
  updateCostCenter: (id: string, patch: Partial<Pick<CostCenter, 'name' | 'emoji' | 'color'>>) => Promise<void>
  deleteCostCenter: (id: string) => Promise<void>
  addCategory: (costCenterId: string, name: string) => Promise<Category>
  renameCategory: (costCenterId: string, categoryId: string, name: string) => Promise<void>
  deleteCategory: (costCenterId: string, categoryId: string) => Promise<void>

  addBill: (input: NewBill) => Promise<Bill>
  updateBill: (id: string, patch: Partial<NewBill>) => Promise<void>
  deleteBill: (id: string) => Promise<void>
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([])
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([])
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimits>(() => loadSpendingLimits<SpendingLimits>({}))
  const [profile, setProfile] = useState<Profile>(() => loadProfile<Profile>({ name: brand.userName }))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [acc, tx, cc, bl, gl, gc, pi] = await Promise.all([
        getAll<Account>('accounts'),
        getAll<Transaction>('transactions'),
        getAll<CostCenter>('costCenters'),
        getAll<Bill>('bills'),
        getAll<Goal>('goals'),
        getAll<GoalContribution>('goalContributions'),
        getAll<PlannedItem>('plannedItems'),
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
      status: input.status ?? (input.costCenterId && input.categoryId ? 'classificado' : 'aguardando_classificacao'),
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    }
    await putItem('transactions', transaction)
    setTransactions((prev) => [...prev, transaction])
    return transaction
  }, [])

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<NewTransaction>) => {
      const existing = transactions.find((t) => t.id === id)
      if (!existing) return
      const merged = { ...existing, ...patch }
      const updated: Transaction = {
        ...merged,
        status: merged.costCenterId && merged.categoryId ? 'classificado' : 'aguardando_classificacao',
        updatedAt: now(),
      }
      await putItem('transactions', updated)
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
    },
    [transactions],
  )

  const deleteTransaction = useCallback(async (id: string) => {
    await deleteItem('transactions', id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }, [])

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

    const uncategorized = transactions.filter((t) => !t.costCenterId || !t.categoryId)
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
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    addCategory,
    renameCategory,
    deleteCategory,
    addBill,
    updateBill,
    deleteBill,
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
