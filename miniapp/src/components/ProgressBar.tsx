interface Props {
  value: number
  max: number
  color?: string
}

export function ProgressBar({ value, max, color = 'bg-blue-500' }: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full bg-white/10 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
