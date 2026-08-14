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

export function daysUntil(iso: string): number {
  const today = new Date('2026-08-13')
  const target = new Date(iso)
  const diff = target.getTime() - today.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}
