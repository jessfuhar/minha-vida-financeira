interface Stage {
  emoji: string
  label: string
  scale: number
  opacity: number
}

// Estágios delicados de "floração" — usados como indicador visual alternativo
// à barra de progresso, evitando algo infantilizado (um único elemento, sem
// animação exagerada, na paleta rosa da marca).
const STAGES: Stage[] = [
  { emoji: '🌱', label: 'Começando', scale: 0.62, opacity: 0.55 },
  { emoji: '🌿', label: 'Crescendo', scale: 0.76, opacity: 0.7 },
  { emoji: '🌸', label: 'Na metade do caminho', scale: 0.88, opacity: 0.85 },
  { emoji: '🌷', label: 'Quase lá', scale: 1, opacity: 1 },
  { emoji: '🌷', label: 'Meta alcançada', scale: 1.12, opacity: 1 },
]

function stageForPercent(pct: number): Stage {
  if (pct >= 100) return STAGES[4]
  if (pct >= 75) return STAGES[3]
  if (pct >= 50) return STAGES[2]
  if (pct >= 25) return STAGES[1]
  return STAGES[0]
}

interface GoalProgressMascotProps {
  percent: number
  size?: number
}

export function GoalProgressMascot({ percent, size = 34 }: GoalProgressMascotProps) {
  const stage = stageForPercent(percent)
  const isComplete = percent >= 100
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full transition-colors duration-500"
      style={{
        width: size + 14,
        height: size + 14,
        background: isComplete
          ? 'color-mix(in srgb, var(--color-status-good) 16%, white)'
          : 'color-mix(in srgb, var(--color-rose-500) 12%, white)',
      }}
      title={stage.label}
      aria-label={stage.label}
    >
      <span
        className="transition-all duration-500 ease-out"
        style={{
          fontSize: size * stage.scale,
          opacity: stage.opacity,
          lineHeight: 1,
          filter: isComplete ? 'drop-shadow(0 0 2px color-mix(in srgb, var(--color-status-good) 40%, transparent))' : undefined,
        }}
      >
        {stage.emoji}
      </span>
    </div>
  )
}
