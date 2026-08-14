import { formatCurrency } from '../../lib/format'

// Rampa sequencial rosa (clara → escura), do menos para o mais representativo.
export const roseSequential = ['#FFD4D9', '#F5AFB5', '#EB8A90', '#DD7079', '#C9636F', '#A84550', '#7A2E37']
// Rampa sequencial azul, usada quando dois contextos sequenciais aparecem lado a lado.
export const blueSequential = ['#DCEBF7', '#B8D3EE', '#8FB8E2', '#5E97D2', '#3D7EBF', '#2C6CAE', '#1F4F82']

interface MagnitudeItem {
  name: string
  value: number
}

interface MagnitudeBarChartProps {
  data: MagnitudeItem[]
  ramp?: string[]
}

/**
 * Comparação de magnitude (gasto por centro de custo / categoria) — cor
 * sequencial de um único matiz, mais escura para o maior valor. A
 * identidade de cada barra já vem do rótulo no eixo, então não é preciso
 * legenda categórica aqui (ver skill de dataviz — "sequential is the safe
 * default" para comparação de magnitude).
 */
export function MagnitudeBarChart({ data, ramp = roseSequential }: MagnitudeBarChartProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const max = Math.max(...sorted.map((d) => d.value), 1)
  // mais escuro = maior valor
  const shadeFor = (rank: number, total: number) => {
    const steps = ramp.length
    const idx = total <= 1 ? steps - 1 : Math.round((rank / (total - 1)) * (steps - 1))
    return ramp[steps - 1 - idx]
  }

  return (
    <ul className="space-y-3.5">
      {sorted.map((item, i) => {
        const pct = (item.value / max) * 100
        const color = shadeFor(i, sorted.length)
        return (
          <li key={item.name}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-medium text-neutral-700">{item.name}</span>
              <span className="font-semibold tabular-nums text-neutral-900">{formatCurrency(item.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
