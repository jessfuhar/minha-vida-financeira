interface ProgressBarProps {
  value: number // 0-100
  color?: string
  trackClassName?: string
  height?: number
}

export function ProgressBar({ value, color = 'var(--color-rose-500)', height = 8 }: ProgressBarProps) {
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
        style={{ width: `${clamped}%`, background: `linear-gradient(90deg, ${color}, var(--color-rose-700))` }}
      />
    </div>
  )
}
