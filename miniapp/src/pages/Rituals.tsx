import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Ritual } from '../api'

export function Rituals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [toggleErr, setToggleErr] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    api.rituals(initData)
      .then(d => { setRituals(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function toggle(id: string) {
    setToggling(id)
    setToggleErr('')
    try {
      const res = await api.toggleRitual(initData, id)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, done: res.done } : r))
      onDataChange?.()
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const done = rituals.filter(r => r.done).length

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>РИТУАЛИ</span>
        <span>{done}/{rituals.length}</span>
      </div>

      {toggleErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{toggleErr}</div>
      )}

      {rituals.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Немає ритуалів.<br />Додай через бот: /addritual Ранкова зарядка
        </div>
      )}

      <div>
        {rituals.map(r => (
          <button
            key={r.id}
            onClick={() => toggle(r.id)}
            disabled={toggling === r.id}
            className="w-full flex items-center justify-between px-4 py-4 text-left"
            style={{
              background: r.done ? 'var(--subtle)' : 'transparent',
              cursor: 'pointer',
              border: 'none',
              borderBottom: '1px solid var(--subtle)',
              opacity: toggling === r.id ? 0.5 : 1,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  border: `2px solid ${r.done ? 'var(--ink)' : 'var(--muted)'}`,
                  background: r.done ? 'var(--ink)' : 'transparent',
                }}
              >
                {r.done && <span style={{ fontSize: '10px', color: 'var(--bg)' }}>✓</span>}
              </div>
              <span
                className="font-condensed text-sm"
                style={{ textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.5 : 1 }}
              >
                {r.icon && `${r.icon} `}{r.title}
              </span>
            </div>
            {r.streak > 0 && (
              <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.streak}🔥</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
