import { useEffect, useState } from 'react'
import { api } from '../api'
import type { FoodEntry } from '../api'

export function Food({ initData }: { initData: string }) {
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.food(initData)
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  const total = entries.reduce((s, e) => s + (e.kcal ?? 0), 0)

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЇЖА — СЬОГОДНІ</span>
        <span>{total} ккал</span>
      </div>

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нічого не записано.<br />Додай через бот або кнопку «Їжу» на головній.
        </div>
      )}

      <div>
        {entries.map(e => (
          <div
            key={e.id}
            className="flex items-center justify-between px-4 py-4"
            style={{ borderBottom: '1px solid var(--subtle)' }}
          >
            <span className="font-condensed text-sm">
              {e.food_name}{e.grams != null ? ` ${e.grams}г` : ''}
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{e.kcal} ккал</span>
          </div>
        ))}
      </div>
    </div>
  )
}
