/**
 * Tipos compartilhados usados em mais de um lugar da interface.
 *
 * Os modelos de dados persistidos (contas, lançamentos, centros de custo,
 * contas a pagar, metas, perfil) vivem em `src/db/models.ts`. Este arquivo
 * guarda apenas tipos auxiliares de exibição — enums de rótulo/status e a
 * forma das notificações, que continuam ilustrativas nesta fase.
 */

/** Tipos de lançamento que o sistema diferencia visualmente. */
export type TransactionKind =
  | 'pix_enviado'
  | 'pix_recebido'
  | 'transferencia_enviada'
  | 'transferencia_recebida'
  | 'transferencia_interna'
  | 'boleto'
  | 'cartao_credito'
  | 'debito'
  | 'saque'
  | 'deposito'
  | 'outros'

export type TransactionDirection = 'entrada' | 'saida'

export type TransactionStatus = 'classificado' | 'aguardando_classificacao' | 'conciliado'

/** Status de exibição de uma conta a pagar — "vencida" é sempre calculado, nunca gravado. */
export type BillStatus = 'pendente' | 'paga' | 'vencida'

export type AlertLevel = 'info' | 'atencao' | 'urgente'

export interface AttentionAlert {
  id: string
  level: AlertLevel
  title: string
  description?: string
  /** Estado de navegação extra passado para `navigate(destination, { state })` — ex.: pré-ativar um
   * filtro na tela de destino, para a usuária chegar direto onde resolve a pendência. */
  state?: Record<string, unknown>
}

export type NotificationType = 'classificacao' | 'vencimento' | 'vencida' | 'saldo' | 'cofrinho'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  description: string
  date: string
  read: boolean
}
