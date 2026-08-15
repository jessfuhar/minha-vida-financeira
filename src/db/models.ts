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
  /** Documento/identificador do lançamento (nº do documento, FITID do extrato, etc.), quando existir. */
  document?: string
  /** Nome da pessoa, empresa, estabelecimento ou instituição relacionada (contraparte) — extraído do
   * extrato quando possível, sempre editável. Nunca sobrescreve a descrição nem o histórico original. */
  counterparty?: string
  /** Arquivo de origem da importação (ex.: "jan-2026.ofx"), para referência interna — não precisa aparecer sempre na UI. */
  sourceFile?: string
  /** Origem do lançamento — puramente informativo, nunca bloqueia edição. Ausente = lançamento antigo (tratado como manual). */
  source?: 'manual' | 'importado'
  /** Preenchido quando o lançamento foi gerado automaticamente ao pagar uma conta. */
  billId?: string
  /** Preenchido nas duas pontas de uma transferência entre contas próprias — mesmo valor nas duas,
   * usado para localizar o par (`transactions.filter(t => t.transferId === x)`) sem precisar de uma 3ª entidade. */
  transferId?: string
  /** Guarda o `kind` anterior a virar uma transferência vinculada, para poder restaurar ao desvincular. */
  preTransferKind?: TransactionKind
  createdAt: string
  updatedAt: string
}

/**
 * Regra de classificação aprendida a partir das escolhas da usuária: quando uma contraparte
 * (normalizada) já foi classificada antes, a próxima importação sugere a mesma categoria/centro de
 * custo. Nunca criada automaticamente para tipos genéricos (ex.: "Pix enviado") — sempre amarrada a
 * um padrão de contraparte específico.
 */
export interface ClassificationRule {
  id: string
  /** Contraparte normalizada (maiúsculas, sem acento/pontuação/espaços duplicados) — chave de correspondência. */
  pattern: string
  /** Texto da contraparte como visto da primeira vez, só para exibição legível na tela de regras. */
  label: string
  categoryId: string | null
  costCenterId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  useCount: number
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

/** Chaves das seções personalizáveis do painel inicial (Dashboard) — mostrar/ocultar, reordenar
 * (inclusive por drag-and-drop) e restaurar padrão, em Configurações → Personalizar painel. */
export type DashboardSectionKey = 'stats' | 'accounts' | 'cashflow' | 'attention' | 'goal' | 'favoriteCostCenters' | 'recentTransactions'

export interface DashboardLayout {
  /** Ordem de exibição das seções — sempre contém todas as chaves de DashboardSectionKey. */
  order: DashboardSectionKey[]
  /** Seções ocultas pela usuária (as demais, visíveis). */
  hidden: DashboardSectionKey[]
  /** Centros de Custo marcados como favoritos — exibidos na seção "favoriteCostCenters". */
  favoriteCostCenterIds: string[]
}
