const CELLS = 10

interface Props {
  value: number
  max: number
  /** текст після бару, напр. «62%» або «3/5» */
  label?: string
  /** колір заповнених клітинок; за замовчуванням чорнила */
  color?: string
}

/** Типографський прогрес-бар «Паперової ОС»: ▮▮▮▮▮▮▯▯▯▯ 62% */
export function MonoBar({ value, max, label, color = 'var(--ink)' }: Props) {
  const pct = max > 0 ? Math.min(1, value / max) : 0
  // Ненульовий прогрес завжди показує хоча б одну клітинку
  const filled = pct > 0 ? Math.max(1, Math.round(pct * CELLS)) : 0
  return (
    <span
      className="font-mono text-sm"
      style={{ letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
      role="img"
      aria-label={label ?? `${value} з ${max}`}
    >
      <span aria-hidden="true" style={{ color }}>{'▮'.repeat(filled)}</span>
      <span aria-hidden="true" style={{ color: 'var(--muted)', opacity: 0.45 }}>{'▯'.repeat(CELLS - filled)}</span>
      {label && <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>{label}</span>}
    </span>
  )
}
