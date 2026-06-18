interface Props {
  value: number
  max: number
  color?: string
  height?: string
}

export function ProgressBar({ value, max, color = 'bg-indigo-600', height = 'h-1.5' }: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`w-full rounded-full ${height}`} style={{ background: 'var(--subtle)' }}>
      <div
        className={`${color} ${height} rounded-full transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
