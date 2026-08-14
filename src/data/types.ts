/**
 * Tipos compartilhados dos dados fictícios usados nesta fase.
 *
 * Nada aqui é persistido ou lido de um banco de dados — são apenas
 * estruturas em memória para dar forma à interface. A forma foi pensada
 * para já comportar, na fase 2, a leitura real de extratos (OFX/CSV/PDF)
 * sem precisar redesenhar as telas.
 */

/** Tipos de lançamento que o sistema deverá diferenciar futuramente. */
export type TransactionKind =
  | 'pix_enviado'
  | 'pix_recebido'
  | 'transferencia_enviada'
  | 'transferencia_recebida'
  | 'boleto'
  | 'cartao_credito'
  | 'debito'
  | 'saque'
  | 'deposito'
  | 'outros'

export type TransactionDirection = 'entrada' | 'saida'

export type TransactionStatus = 'classificado' | 'aguardando_classificacao' | 'conciliado'

export interface Transaction {
  id: string
  date: string // ISO yyyy-mm-dd
  description: string
  kind: TransactionKind
  direction: TransactionDirection
  amount: number
  accountId: string
  costCenter: string
  category: string
  status: TransactionStatus
}

export interface BankAccount {
  id: string
  bank: string
  nickname?: string
  type: 'corrente' | 'poupanca' | 'digital'
  balance: number
  colorFrom: string
  colorTo: string
  logoInitial: string
}

export type BillStatus = 'pendente' | 'paga' | 'vencida'

export interface Bill {
  id: string
  name: string
  amount: number
  dueDate: string
  category: string
  costCenter: string
  status: BillStatus
}

export interface SavingsGoal {
  id: string
  name: string
  emoji: string
  target: number
  saved: number
  color: string
  monthlyContribution: number
  deadline?: string
}

export interface CostCenter {
  id: string
  name: string
  emoji: string
  categories: string[]
  monthlySpend: number
  color: string
}

export type AlertLevel = 'info' | 'atencao' | 'urgente'

export interface AttentionAlert {
  id: string
  level: AlertLevel
  title: string
  description?: string
}

export type NotificationType =
  | 'classificacao'
  | 'vencimento'
  | 'vencida'
  | 'saldo'
  | 'cofrinho'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  description: string
  date: string
  read: boolean
}
