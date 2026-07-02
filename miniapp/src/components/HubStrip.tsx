import type { CSSProperties } from 'react'
import { OPEN_MODULES } from './NavGrid'
import { haptic } from '../utils'

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

// Згорнута сітка всередині модуля: ⌂ 02 / ВОДА ‹ ›
// ⌂ повертає на головну, ‹ › листають сусідні модулі (без «Сьогодні», по колу)
export function HubStrip({ activeView, onNavigate }: Props) {
  const ring = OPEN_MODULES.filter(m => m.id !== 'today')
  const idx = ring.findIndex(m => m.id === activeView)
  const current = ring[idx] ?? ring[0]
  const prev = ring[(idx - 1 + ring.length) % ring.length]
  const next = ring[(idx + 1) % ring.length]

  const go = (id: string) => { haptic('light'); onNavigate(id) }

  const cellStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    minWidth: '44px',
  }

  return (
    <div
      className="flex items-stretch"
      style={{ background: 'var(--ink)', color: 'var(--bg)', height: '40px', borderBottom: '1px solid var(--subtle)' }}
    >
      <button
        onClick={() => go('today')}
        style={{ ...cellStyle, borderRight: '1px solid color-mix(in srgb, var(--bg) 15%, transparent)' }}
        aria-label="На головну"
      >
        ⌂
      </button>
      <div className="flex items-center gap-2 flex-1 px-3">
        <span className="font-mono text-xs" style={{ opacity: 0.5 }}>{current.num}</span>
        <span className="font-condensed text-sm font-semibold" style={{ letterSpacing: '0.05em' }}>
          {current.label.toUpperCase()}
        </span>
      </div>
      <button
        onClick={() => go(prev.id)}
        style={{ ...cellStyle, borderLeft: '1px solid color-mix(in srgb, var(--bg) 15%, transparent)', opacity: 0.7 }}
        aria-label={`Попередній: ${prev.label}`}
      >
        ‹
      </button>
      <button
        onClick={() => go(next.id)}
        style={{ ...cellStyle, borderLeft: '1px solid color-mix(in srgb, var(--bg) 15%, transparent)', opacity: 0.7 }}
        aria-label={`Наступний: ${next.label}`}
      >
        ›
      </button>
    </div>
  )
}
