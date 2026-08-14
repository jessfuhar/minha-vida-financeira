/**
 * Período mensal global (mês/ano) — controla, de forma compartilhada, o Fluxo de Caixa, os Centros
 * de Custo e os Relatórios. Sempre começa no mês atual do dispositivo ao abrir/recarregar o sistema
 * (nunca é persistido em disco de propósito) e é preservado enquanto a usuária navega entre essas
 * telas, porque vive num Context acima das rotas.
 */
import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { monthLabelLong, shiftMonthKey } from '../lib/aggregations'

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface PeriodContextValue {
  /** Chave do período selecionado, formato "YYYY-MM". */
  period: string
  year: number
  month: number
  /** Ex.: "Janeiro 2026". */
  label: string
  isCurrentMonth: boolean
  setPeriod: (key: string) => void
  setMonth: (month: number) => void
  setYear: (year: number) => void
  prevMonth: () => void
  nextMonth: () => void
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<string>(() => currentMonthKey())

  const setMonth = useCallback((month: number) => {
    setPeriod((prev) => {
      const [y] = prev.split('-')
      return `${y}-${String(month).padStart(2, '0')}`
    })
  }, [])

  const setYear = useCallback((year: number) => {
    setPeriod((prev) => {
      const [, m] = prev.split('-')
      return `${year}-${m}`
    })
  }, [])

  const prevMonth = useCallback(() => setPeriod((prev) => shiftMonthKey(prev, -1)), [])
  const nextMonth = useCallback(() => setPeriod((prev) => shiftMonthKey(prev, 1)), [])

  const value = useMemo<PeriodContextValue>(() => {
    const [yearStr, monthStr] = period.split('-')
    return {
      period,
      year: Number(yearStr),
      month: Number(monthStr),
      label: monthLabelLong(period),
      isCurrentMonth: period === currentMonthKey(),
      setPeriod,
      setMonth,
      setYear,
      prevMonth,
      nextMonth,
    }
  }, [period, setMonth, setYear, prevMonth, nextMonth])

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod deve ser usado dentro de <PeriodProvider>')
  return ctx
}
