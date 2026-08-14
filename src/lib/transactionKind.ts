import type { TransactionKind } from '../data/types'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  Wallet,
  Banknote,
  PiggyBank,
  CircleEllipsis,
  type LucideIcon,
} from 'lucide-react'

export interface TransactionKindMeta {
  label: string
  icon: LucideIcon
  /** categórica: cada tipo tem uma cor própria, discreta, para leitura rápida */
  colorVar: string
}

export const kindsByDirection: Record<'entrada' | 'saida', TransactionKind[]> = {
  entrada: ['pix_recebido', 'transferencia_recebida', 'deposito', 'transferencia_interna', 'outros'],
  saida: ['pix_enviado', 'transferencia_enviada', 'boleto', 'cartao_credito', 'debito', 'saque', 'transferencia_interna', 'outros'],
}

/** true para o tipo usado nas duas pontas de uma transferência entre contas próprias — nunca é
 * receita/despesa real, então fica de fora de relatórios, gastos por categoria e afins. */
export function isInternalTransferKind(kind: TransactionKind): boolean {
  return kind === 'transferencia_interna'
}

export const transactionKindMeta: Record<TransactionKind, TransactionKindMeta> = {
  pix_enviado: { label: 'Pix enviado', icon: ArrowUpRight, colorVar: 'var(--color-cat-rose)' },
  pix_recebido: { label: 'Pix recebido', icon: ArrowDownLeft, colorVar: 'var(--color-cat-teal)' },
  transferencia_enviada: { label: 'Transferência enviada', icon: ArrowUpRight, colorVar: 'var(--color-cat-amber)' },
  transferencia_recebida: { label: 'Transferência recebida', icon: ArrowDownLeft, colorVar: 'var(--color-cat-blue)' },
  transferencia_interna: { label: 'Transferência entre contas', icon: ArrowLeftRight, colorVar: 'var(--color-neutral-600)' },
  boleto: { label: 'Boleto', icon: Receipt, colorVar: 'var(--color-cat-amber)' },
  cartao_credito: { label: 'Cartão de crédito', icon: CreditCard, colorVar: 'var(--color-cat-violet)' },
  debito: { label: 'Débito', icon: Wallet, colorVar: 'var(--color-neutral-600)' },
  saque: { label: 'Saque', icon: Banknote, colorVar: 'var(--color-cat-sage)' },
  deposito: { label: 'Depósito', icon: PiggyBank, colorVar: 'var(--color-cat-teal)' },
  outros: { label: 'Outros', icon: CircleEllipsis, colorVar: 'var(--color-neutral-500)' },
}
