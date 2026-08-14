interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

/** Mini gráfico de linha, sem eixos, para acompanhar um número dentro de um stat tile. */
export function Sparkline({ data, color = 'var(--color-rose-500)', width = 88, height = 30 }: SparklineProps) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  const areaPoints = `0,${height} ${points.join(' ')} ${width},${height}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={Number(points[points.length - 1].split(',')[1])} r={3} fill={color} />
    </svg>
  )
}
