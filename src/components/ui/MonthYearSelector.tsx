import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { usePeriod } from '../../context/PeriodContext'

const MONTH_NAMES = [
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

/**
 * Seletor global de mês/ano — "←  Janeiro 2026  →" — usado no Fluxo de Caixa, Centros de Custo e
 * Relatórios. O período fica no `PeriodContext`, então trocar de tela preserva a seleção.
 */
export function MonthYearSelector({ className = '' }: { className?: string }) {
  const { year, month, label, setPeriod, prevMonth, nextMonth } = usePeriod()
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)

  const openPicker = () => {
    setPickerYear(year)
    setOpen(true)
  }

  const choose = (m: number) => {
    setPeriod(`${pickerYear}-${String(m).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div className="flex items-center gap-0.5 rounded-full bg-[var(--color-neutral-100)] p-1">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Mês anterior"
          className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-rose-700"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={openPicker}
          aria-haspopup="true"
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-neutral-800 transition-colors hover:bg-white hover:text-rose-700"
        >
          <Calendar size={14} className="text-neutral-400" />
          {label}
        </button>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Próximo mês"
          className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-white hover:text-rose-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-2xl border border-[var(--border-hairline)] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-rose-700"
                aria-label="Ano anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="font-display text-[15px] font-semibold text-neutral-900">{pickerYear}</p>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-rose-700"
                aria-label="Próximo ano"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_NAMES.map((name, idx) => {
                const m = idx + 1
                const isSelected = pickerYear === year && m === month
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => choose(m)}
                    className={[
                      'rounded-lg px-2 py-2 text-[12.5px] font-medium transition-colors',
                      isSelected ? 'bg-rose-700 text-white' : 'text-neutral-600 hover:bg-rose-50 hover:text-rose-800',
                    ].join(' ')}
                  >
                    {name.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
