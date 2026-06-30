import { useEffect, useState } from 'react'
import { api } from '../api'
import type { FoodEntry } from '../api'
import { SwipeRow } from '../components/SwipeRow'

interface Props {
  initData: string
  kcalGoal?: number | null
}

export function Food({ initData, kcalGoal }: Props) {
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')

  useEffect(() => {
    api.food(initData)
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteFoodEntry(initData, id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  const total = entries.reduce((s, e) => s + (e.kcal ?? 0), 0)
  const pct = kcalGoal && kcalGoal > 0 ? Math.min(100, Math.round((total / kcalGoal) * 100)) : null

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЇЖА — СЬОГОДНІ</span>
        <span>{total}{kcalGoal ? ` / ${kcalGoal}` : ''} ккал</span>
      </div>

      {pct !== null && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--subtle)' }}>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--subtle)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: pct >= 100 ? '#dc2626' : '#f97316' }}
            />
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>{pct}% від денної норми</div>
        </div>
      )}

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нічого не записано.<br />Додай через бот або кнопку «Їжу» на головній.
        </div>
      )}

      {entries.map(e => (
        <SwipeRow
          key={e.id}
          id={e.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(e.id) },
          ]}
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-condensed text-sm flex-1 mr-3 line-clamp-1">
              {e.food_name}{e.grams != null ? ` ${e.grams}г` : ''}
            </span>
            <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{e.kcal} ккал</span>
          </div>
        </SwipeRow>
      ))}
    </div>
  )
}
