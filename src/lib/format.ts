export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatCurrencySigned(value: number, direction: 'entrada' | 'saida'): string {
  const sign = direction === 'entrada' ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(value))}`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function formatDateLong(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date('2026-08-13T12:00:00')
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  const diffH = Math.round(diffMin / 60)
  const diffD = Math.round(diffH / 24)
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffH < 24) return `há ${diffH} h`
  if (diffD === 1) return 'ontem'
  return `há ${diffD} dias`
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return formatCurrency(value)
}

/**
 * Converte texto digitado num campo de valor em número. Aceita tanto o
 * formato brasileiro (1.234,56) quanto ponto decimal simples (1234.56).
 */
export function parseCurrencyInput(raw: string): number {
  let s = raw.trim().replace(/[^\d,.-]/g, '')
  if (s === '') return NaN
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    const parts = s.split('.')
    if (parts.length > 2) {
      s = parts.join('')
    }
  }
  return Number(s)
}

/** True se o texto digitado representa um valor monetário válido (aceita BRL e ponto decimal). */
export function isValidCurrencyInput(raw: string): boolean {
  if (raw.trim() === '') return false
  return !Number.isNaN(parseCurrencyInput(raw))
}
