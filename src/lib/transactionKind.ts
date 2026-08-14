import type { TransactionKind } from '../data/types'
import {
  ArrowDownLeft,
  ArrowUpRight,
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

export const transactionKindMeta: Record<TransactionKind, TransactionKindMeta> = {
  pix_enviado: { label: 'Pix enviado', icon: ArrowUpRight, colorVar: 'var(--color-cat-rose)' },
  pix_recebido: { label: 'Pix recebido', icon: ArrowDownLeft, colorVar: 'var(--color-cat-teal)' },
  transferencia_enviada: { label: 'Transferência enviada', icon: ArrowUpRight, colorVar: 'var(--color-cat-amber)' },
  transferencia_recebida: { label: 'Transferência recebida', icon: ArrowDownLeft, colorVar: 'var(--color-cat-blue)' },
  boleto: { label: 'Boleto', icon: Receipt, colorVar: 'var(--color-cat-amber)' },
  cartao_credito: { label: 'Cartão de crédito', icon: CreditCard, colorVar: 'var(--color-cat-violet)' },
  debito: { label: 'Débito', icon: Wallet, colorVar: 'var(--color-neutral-600)' },
  saque: { label: 'Saque', icon: Banknote, colorVar: 'var(--color-cat-sage)' },
  deposito: { label: 'Depósito', icon: PiggyBank, colorVar: 'var(--color-cat-teal)' },
  outros: { label: 'Outros', icon: CircleEllipsis, colorVar: 'var(--color-neutral-500)' },
}
