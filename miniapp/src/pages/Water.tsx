import { useEffect, useState } from 'react'
import { api } from '../api'
import { useToast } from '../components/Toast'
import { xpToastText } from '../utils'

export function Water({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [total, setTotal] = useState(0)
  const [goal, setGoal] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.water(initData)
      .then(d => { setTotal(d.total); setGoal(d.goal ?? 2000); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function addWater(amount: number) {
    setSaving(true)
    try {
      const d = await api.addWater(initData, amount)
      setTotal(d.total)
      if (d.xp_granted) push(xpToastText(d.xp_granted))
      onDataChange?.()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        ВОДА — СЬОГОДНІ
      </div>

      <div className="px-4 py-6 space-y-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <div className="flex items-baseline justify-between">
          <span className="font-condensed font-bold text-4xl">{total}</span>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>/ {goal} мл</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: 'var(--subtle)' }}>
          <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: '#3b82f6' }} />
        </div>
        <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
          {pct}% від мети{total >= goal ? ' · 🎉 виконано!' : ''}
        </div>
      </div>

      <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        {[250, 500, 1000].map((ml, idx, arr) => (
          <button
            key={ml}
            onClick={() => addWater(ml)}
            disabled={saving}
            className="flex flex-col items-center py-5"
            style={{ background: 'transparent', border: 'none', borderRight: idx < arr.length - 1 ? '1px solid var(--subtle)' : 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            <span style={{ fontSize: '24px', lineHeight: 1 }}>💧</span>
            <span className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>+{ml} мл</span>
          </button>
        ))}
      </div>
    </div>
  )
}
