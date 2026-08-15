import type { Account, Transaction, Bill } from '../db/models'
import type { BillStatus as DisplayBillStatus } from '../data/types'
import { isInternalTransferKind } from './transactionKind'

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const MONTH_LABELS_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7) // YYYY-MM
}

export function yearKey(dateIso: string): string {
  return dateIso.slice(0, 4) // YYYY
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_LABELS[month - 1]}/${year}`
}

/** Nome do mês por extenso + ano — ex.: "Janeiro 2026". Usado no seletor global de período
 * (Fluxo de Caixa / Centros de Custo / Relatórios), onde o enunciado pede explicitamente esse
 * formato ("← Janeiro 2026 →"), diferente do rótulo abreviado usado nos gráficos de tendência. */
export function monthLabelLong(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_LABELS_LONG[month - 1]} ${year}`
}

export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfMonthIso(year: number, monthIndex0: number): string {
  const d = new Date(year, monthIndex0 + 1, 0)
  return d.toISOString().slice(0, 10)
}

/** Últimos `count` meses (mais antigo → mais recente), incluindo o mês atual. */
export function lastMonths(count: number, reference = new Date()) {
  const months: { key: string; label: string; endOfMonthIso: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({
      key,
      label: MONTH_LABELS[d.getMonth()],
      endOfMonthIso: lastDayOfMonthIso(d.getFullYear(), d.getMonth()),
    })
  }
  return months
}

/** Últimos `count` dias (mais antigo → mais recente), incluindo hoje. */
export function lastDays(count: number, reference = new Date()) {
  const days: { key: string; label: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(reference)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` })
  }
  return days
}

/**
 * Saldo total consolidado numa data de referência: saldo inicial de cada
 * conta + lançamentos daquela conta entre a data de referência do saldo e
 * a data pedida. Lançamentos anteriores à data de referência do saldo da
 * conta não são considerados (assume-se que o saldo informado já os
 * reflete).
 */
export function totalBalanceAsOf(accounts: Account[], transactions: Transaction[], asOfIso: string): number {
  return accounts.reduce((sum, acc) => sum + accountBalanceAsOf(acc, transactions, asOfIso), 0)
}

export function accountBalanceAsOf(account: Account, transactions: Transaction[], asOfIso: string): number {
  const net = transactions
    .filter((t) => t.accountId === account.id && t.date >= account.openingDate && t.date <= asOfIso)
    .reduce((s, t) => s + (t.direction === 'entrada' ? t.amount : -t.amount), 0)
  return account.openingBalance + net
}

export function accountBalanceNow(account: Account, transactions: Transaction[]): number {
  return accountBalanceAsOf(account, transactions, todayIso())
}

export function totalBalanceNow(accounts: Account[], transactions: Transaction[]): number {
  return totalBalanceAsOf(accounts, transactions, todayIso())
}

export interface MonthTotals {
  entradas: number
  saidas: number
}

export function monthTotals(transactions: Transaction[], key: string): MonthTotals {
  return transactions
    .filter((t) => monthKey(t.date) === key && !isInternalTransferKind(t.kind))
    .reduce(
      (acc, t) => {
        if (t.direction === 'entrada') acc.entradas += t.amount
        else acc.saidas += t.amount
        return acc
      },
      { entradas: 0, saidas: 0 },
    )
}

export interface CashFlowSeriesPoint {
  label: string
  entradas: number
  saidas: number
  saldo: number
}

export function monthlyCashFlowSeries(
  accounts: Account[],
  transactions: Transaction[],
  months = 6,
): CashFlowSeriesPoint[] {
  return lastMonths(months).map(({ key, label, endOfMonthIso }) => {
    const { entradas, saidas } = monthTotals(transactions, key)
    const saldo = totalBalanceAsOf(accounts, transactions, endOfMonthIso)
    return { label, entradas, saidas, saldo }
  })
}

export function dailyCashFlowSeries(accounts: Account[], transactions: Transaction[], days = 6): CashFlowSeriesPoint[] {
  return lastDays(days).map(({ key, label }) => {
    const dayTx = transactions.filter((t) => t.date === key)
    const entradas = dayTx.filter((t) => t.direction === 'entrada').reduce((s, t) => s + t.amount, 0)
    const saidas = dayTx.filter((t) => t.direction === 'saida').reduce((s, t) => s + t.amount, 0)
    const saldo = totalBalanceAsOf(accounts, transactions, key)
    return { label, entradas, saidas, saldo }
  })
}

/** Total de saídas num intervalo de datas (inclusive). Transferências entre contas próprias não
 * entram aqui — não são despesa real, o dinheiro só mudou de conta. */
export function saidasBetween(transactions: Transaction[], fromIso: string, toIso: string): number {
  return transactions
    .filter((t) => t.direction === 'saida' && t.date >= fromIso && t.date <= toIso && !isInternalTransferKind(t.kind))
    .reduce((s, t) => s + t.amount, 0)
}

export function saidasNoDia(transactions: Transaction[], dayIso: string): number {
  return saidasBetween(transactions, dayIso, dayIso)
}

export function saidasNoMes(transactions: Transaction[], key: string): number {
  return transactions
    .filter((t) => t.direction === 'saida' && monthKey(t.date) === key && !isInternalTransferKind(t.kind))
    .reduce((s, t) => s + t.amount, 0)
}

export function saidasNoAno(transactions: Transaction[], key: string): number {
  return transactions
    .filter((t) => t.direction === 'saida' && yearKey(t.date) === key && !isInternalTransferKind(t.kind))
    .reduce((s, t) => s + t.amount, 0)
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

/** Projeção simples de gasto do mês inteiro, a partir do ritmo de gasto até agora. */
export function projectMonthSpend(spentSoFar: number, referenceIso = todayIso()): number {
  const d = new Date(referenceIso)
  const dayOfMonth = d.getDate()
  const totalDays = daysInMonth(d.getFullYear(), d.getMonth())
  if (dayOfMonth <= 0) return spentSoFar
  return (spentSoFar / dayOfMonth) * totalDays
}

export interface SpendingStatus {
  label: string
  color: string
  bg: string
}

/** Classifica o percentual de uso de um limite de gasto em 4 faixas. */
export function spendingStatus(pct: number): SpendingStatus {
  if (pct >= 100) return { label: 'Limite ultrapassado', color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' }
  if (pct >= 90) return { label: 'Próximo do limite', color: 'var(--color-status-serious)', bg: 'var(--color-status-serious-bg)' }
  if (pct >= 70) return { label: 'Atenção', color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)' }
  return { label: 'Confortável', color: 'var(--color-status-good)', bg: 'var(--color-status-good-bg)' }
}

export interface CategorySpend {
  total: number
  count: number
  items: Transaction[]
}

/** Saídas ("gasto") de uma categoria (dentro de um centro de custo) num mês específico. Um Centro de
 * Custo/categoria também pode ter Entradas associadas (ver `categoryIncomeInMonth`) — deliberadamente
 * NUNCA somadas aqui, para que "gasto" nunca inclua dinheiro que entrou. */
export function categorySpendInMonth(
  transactions: Transaction[],
  costCenterId: string,
  categoryId: string,
  key: string,
): CategorySpend {
  const items = transactions
    .filter(
      (t) =>
        t.direction === 'saida' &&
        monthKey(t.date) === key &&
        t.costCenterId === costCenterId &&
        t.categoryId === categoryId &&
        !isInternalTransferKind(t.kind),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { total: items.reduce((s, t) => s + t.amount, 0), count: items.length, items }
}

/** Saídas ("gasto") de um centro de custo inteiro (todas as categorias + sem categoria) num mês
 * específico — mesma forma de `categorySpendInMonth`, para reaproveitar nos cards e no modal de
 * Centro de Custo. Ver `costCenterIncomeInMonth` para as Entradas do mesmo centro (sempre separadas). */
export function costCenterSpendInMonth(transactions: Transaction[], costCenterId: string, key: string): CategorySpend {
  const items = transactions
    .filter((t) => t.direction === 'saida' && monthKey(t.date) === key && t.costCenterId === costCenterId && !isInternalTransferKind(t.kind))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { total: items.reduce((s, t) => s + t.amount, 0), count: items.length, items }
}

/** Entradas de uma categoria (dentro de um centro de custo) num mês específico. Uma movimentação de
 * Entrada também pode receber Centro de Custo/categoria (ex.: reembolso categorizado em "Casa") —
 * mostrada sempre separadamente do gasto (`categorySpendInMonth`), nunca somada a ele como se fosse
 * a mesma coisa. */
export function categoryIncomeInMonth(
  transactions: Transaction[],
  costCenterId: string,
  categoryId: string,
  key: string,
): CategorySpend {
  const items = transactions
    .filter(
      (t) =>
        t.direction === 'entrada' &&
        monthKey(t.date) === key &&
        t.costCenterId === costCenterId &&
        t.categoryId === categoryId &&
        !isInternalTransferKind(t.kind),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { total: items.reduce((s, t) => s + t.amount, 0), count: items.length, items }
}

/** Entradas de um centro de custo inteiro (todas as categorias + sem categoria) num mês específico —
 * ver `costCenterSpendInMonth` (as Saídas do mesmo centro). Nunca somar os dois totais: um Centro de
 * Custo com Entradas e Saídas deve sempre exibir "Entradas", "Saídas" e, quando fizer sentido,
 * "Resultado" (Entradas − Saídas) como valores distintos — nunca um único "gasto" combinado. */
export function costCenterIncomeInMonth(transactions: Transaction[], costCenterId: string, key: string): CategorySpend {
  const items = transactions
    .filter((t) => t.direction === 'entrada' && monthKey(t.date) === key && t.costCenterId === costCenterId && !isInternalTransferKind(t.kind))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { total: items.reduce((s, t) => s + t.amount, 0), count: items.length, items }
}

/** Deriva o status exibido de uma conta a pagar — "vencida" nunca é gravado, é calculado. */
export function getBillDisplayStatus(bill: Bill, reference = todayIso()): DisplayBillStatus {
  if (bill.status === 'paga') return 'paga'
  return bill.dueDate < reference ? 'vencida' : 'pendente'
}

export function daysUntil(iso: string, reference = todayIso()): number {
  const a = new Date(reference)
  const b = new Date(iso)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

// Rotação de cores/gradientes usada para identificar contas visualmente,
// já que a usuária não escolhe uma cor ao cadastrar a conta.
const ACCOUNT_GRADIENTS: [string, string][] = [
  ['#F5D97A', '#D9A441'],
  ['#8B5CF6', '#6021C4'],
  ['#FF9A6C', '#E8632B'],
  ['#6FB2E8', '#2E6CAE'],
  ['#7DD9C0', '#1F9E88'],
  ['#F09DA2', '#C9636F'],
]

export function accountGradient(id: string): [string, string] {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return ACCOUNT_GRADIENTS[hash % ACCOUNT_GRADIENTS.length]
}

export function accountInitials(bank: string): string {
  const words = bank.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Rotação de cores categóricas para novos centros de custo (validada para
// contraste/CVD — mesma paleta usada nos gráficos).
export const COST_CENTER_COLORS = [
  'var(--color-cat-rose)',
  'var(--color-cat-violet)',
  'var(--color-cat-blue)',
  'var(--color-cat-teal)',
  'var(--color-cat-amber)',
  'var(--color-cat-sage)',
  'var(--color-rose-800)',
]

export function nextCostCenterColor(existingCount: number): string {
  return COST_CENTER_COLORS[existingCount % COST_CENTER_COLORS.length]
}

export const GOAL_COLORS = [
  'var(--color-cat-rose)',
  'var(--color-cat-teal)',
  'var(--color-cat-amber)',
  'var(--color-cat-violet)',
  'var(--color-cat-sage)',
  'var(--color-cat-blue)',
]

export function nextGoalColor(existingCount: number): string {
  return GOAL_COLORS[existingCount % GOAL_COLORS.length]
}
