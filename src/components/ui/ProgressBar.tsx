interface ProgressBarProps {
  value: number // 0-100
  color?: string
  trackClassName?: string
  height?: number
  /** Quando true (padrão), a barra funde a cor com o rosa da marca — use para
   * indicadores "decorativos" (metas, centros de custo). Quando false, usa a
   * cor sólida — use para indicadores de status (confortável/atenção/etc.),
   * onde misturar com rosa distorceria o significado da cor. */
  gradient?: boolean
}

export function ProgressBar({ value, color = 'var(--color-rose-500)', height = 8, gradient = true }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="w-full overflow-hidden rounded-full bg-[var(--color-neutral-200)]"
      style={{ height }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: gradient ? `linear-gradient(90deg, ${color}, var(--color-rose-700))` : color }}
      />
    </div>
  )
}
