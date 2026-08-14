/**
 * Inferência do tipo de movimentação (`TransactionKind`) a partir do texto
 * original do extrato. Nunca "inventa" um tipo específico sem indício
 * textual — na dúvida, cai em 'outros' para edição manual.
 */
import type { TransactionKind, TransactionDirection } from '../data/types'

export interface InferredKind {
  kind: TransactionKind
  /** false quando caímos no padrão neutro 'outros' por falta de indício claro. */
  confident: boolean
}

function stripAccents(s: string): string {
  const diacritics = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g')
  return s.normalize('NFD').replace(diacritics, '')
}

function normalize(s: string): string {
  return stripAccents(s).toLowerCase()
}

/** Tenta identificar Pix recebido/enviado, transferência, TED, DOC, boleto, débito,
 * crédito, cartão, pagamento, saque, depósito — a partir do texto original do extrato. */
export function inferTransactionKind(originalText: string, direction: TransactionDirection | null): InferredKind {
  const t = normalize(originalText || '')

  if (t.includes('pix')) {
    if (t.includes('receb')) return { kind: 'pix_recebido', confident: true }
    if (t.includes('envi')) return { kind: 'pix_enviado', confident: true }
    if (direction === 'entrada') return { kind: 'pix_recebido', confident: false }
    if (direction === 'saida') return { kind: 'pix_enviado', confident: false }
    return { kind: 'outros', confident: false }
  }

  if (/\bted\b/.test(t) || /\bdoc\b/.test(t) || t.includes('transfer')) {
    if (t.includes('receb')) return { kind: 'transferencia_recebida', confident: true }
    if (t.includes('envi') || t.includes('enviad')) return { kind: 'transferencia_enviada', confident: true }
    if (direction === 'entrada') return { kind: 'transferencia_recebida', confident: false }
    return { kind: 'transferencia_enviada', confident: false }
  }

  if (t.includes('boleto') || t.includes('fatura') || t.includes('titulo')) {
    return { kind: 'boleto', confident: true }
  }

  if (t.includes('cartao') && (t.includes('credito') || t.includes('cred'))) {
    return { kind: 'cartao_credito', confident: true }
  }

  if (t.includes('cartao') && t.includes('debito')) {
    return { kind: 'debito', confident: true }
  }

  if (t.includes('debito')) {
    return { kind: 'debito', confident: true }
  }

  if (t.includes('saque') || t.includes('atm') || t.includes('caixa eletronico')) {
    return { kind: 'saque', confident: true }
  }

  if (t.includes('deposito')) {
    return { kind: 'deposito', confident: true }
  }

  return { kind: 'outros', confident: false }
}
