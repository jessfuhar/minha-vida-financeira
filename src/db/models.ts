/**
 * Modelos persistidos localmente no navegador (IndexedDB / localStorage).
 *
 * Estas formas substituem os dados fictícios da fase 1 como fonte de
 * verdade. Nada aqui sai do navegador da usuária — não há backend, login
 * ou sincronização nesta fase.
 */
import type { TransactionKind, TransactionDirection } from '../data/types'

export type AccountType = 'corrente' | 'poupanca' | 'digital' | 'carteira_digital' | 'investimento' | 'outro'

export interface Account {
  id: string
  bank: string
  nickname?: string
  type: AccountType
  /** Saldo informado numa data de referência — não muda com os lançamentos. */
  openingBalance: number
  /** Data de referência do saldo informado (ISO yyyy-mm-dd). */
  openingDate: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
}

export interface CostCenter {
  id: string
  name: string
  emoji: string
  color: string
  categories: Category[]
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  date: string
  /** Descrição amigável, escolhida pela usuária. */
  description: string
  /** Texto exatamente como aparece no extrato, boleto ou comprovante (nome do recebedor/remetente etc.). Base para reconhecimento automático numa fase futura. */
  originalDescription?: string
  kind: TransactionKind
  direction: TransactionDirection
  amount: number
  accountId: string
  costCenterId: string | null
  categoryId: string | null
  status: 'classificado' | 'aguardando_classificacao'
  note?: string
  /** Preenchido quando o lançamento foi gerado automaticamente ao pagar uma conta. */
  billId?: string
  createdAt: string
  updatedAt: string
}

export type BillStatus = 'pendente' | 'paga'

export interface Bill {
  id: string
  name: string
  /** Texto exatamente como aparece no boleto/fatura (ex.: razão social do credor). */
  originalDescription?: string
  amount: number
  dueDate: string
  accountId: string | null
  costCenterId: string | null
  categoryId: string | null
  recurring: boolean
  status: BillStatus
  paidAt?: string
  /** Preenchido quando marcar como paga gerou um lançamento correspondente. */
  transactionId?: string
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  name: string
  emoji: string
  color: string
  target: number
  /**
   * Legado: valor reservado gravado diretamente (fase 2, antes do histórico
   * de aportes). Usado só para migração — o valor reservado atual é sempre
   * a soma dos `GoalContribution` desta meta.
   */
  saved?: number
  sourceAccountId?: string | null
  deadline?: string
  createdAt: string
  updatedAt: string
}

/** Um aporte (movimentação) dentro de uma meta/cofrinho. */
export interface GoalContribution {
  id: string
  goalId: string
  /** Positivo = valor guardado; negativo = valor retirado do cofrinho. */
  amount: number
  date: string
  note?: string
  createdAt: string
  updatedAt: string
}

/** Limites de gasto (aba "Metas") — não afetam saldo, só comparam com os gastos reais. */
export interface SpendingLimits {
  daily?: number
  monthly?: number
  annual?: number
}

/** Item previsto/referência para o orçamento diário — não é um lançamento real. */
export interface PlannedItem {
  id: string
  name: string
  quantity: number
  unitValue: number
  createdAt: string
  updatedAt: string
}

export interface Profile {
  name: string
  photoDataUrl?: string
}
