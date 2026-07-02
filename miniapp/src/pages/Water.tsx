import { useEffect, useState } from 'react'
import { api } from '../api'
import { MonoBar } from '../components/MonoBar'
import { useToast } from '../components/Toast'
import { xpToastText, haptic } from '../utils'

export function Water({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [total, setTotal] = useState(0)
  const [goal, setGoal] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  // Останнє додавання в цій сесії — для «відмінити помилковий тап»
  const [lastAdd, setLastAdd] = useState<number | null>(null)

  useEffect(() => {
    api.water(initData)
      .then(d => { setTotal(d.total); setGoal(d.goal ?? 2000); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function addWater(amount: number) {
    setSaving(true)
    try {
      const d = await api.addWater(initData, amount)
      haptic('success')
      setTotal(d.total)
      setLastAdd(amount)
      if (d.xp_granted) push(xpToastText(d.xp_granted))
      onDataChange?.()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  async function undoLast() {
    if (lastAdd === null) return
    setSaving(true)
    try {
      const d = await api.undoWater(initData, lastAdd)
      haptic('light')
      setTotal(d.total)
      setLastAdd(null)
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
      <div className="px-4 py-6 space-y-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <div className="flex items-baseline justify-between">
          <span className="font-condensed font-bold" style={{ fontSize: '56px', lineHeight: 1 }}>{total}</span>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>/ {goal} мл</span>
        </div>
        <MonoBar value={total} max={goal} color="var(--mod-water)" />
        <div className="font-mono text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.05em' }}>
          {pct}% ВІД МЕТИ{total >= goal ? ' · ВИКОНАНО' : ''}
        </div>
      </div>

      <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        {[250, 500, 1000].map((ml, idx, arr) => (
          <button
            key={ml}
            onClick={() => addWater(ml)}
            disabled={saving}
            className="press-invert flex flex-col items-center py-4"
            style={{ minHeight: '64px', background: 'transparent', border: 'none', borderRight: idx < arr.length - 1 ? '1px solid var(--subtle)' : 'none', color: 'var(--ink)', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            <span className="font-mono font-medium" style={{ fontSize: '17px', lineHeight: 1 }}>+{ml}</span>
            <span className="font-mono mt-1" style={{ fontSize: '10px', color: 'var(--muted)' }}>мл</span>
          </button>
        ))}
      </div>

      {lastAdd !== null && (
        <button
          onClick={undoLast}
          disabled={saving}
          className="press-invert w-full font-mono text-xs"
          style={{ minHeight: '44px', letterSpacing: '0.05em', background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
        >
          ↩ ВІДМІНИТИ ОСТАННЄ (+{lastAdd} МЛ)
        </button>
      )}
    </div>
  )
}
