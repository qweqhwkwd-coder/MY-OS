import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Workout } from '../api'
import { TextField } from '../components/TextField'
import { useToast } from '../components/Toast'
import { xpToastText, haptic } from '../utils'

const TYPE_EMOJI: Record<string, string> = {
  cardio: '🏃',
  strength: '💪',
  flexibility: '🧘',
  other: '🏋️',
}

const TYPE_LABEL: Record<string, string> = {
  cardio: 'кардіо',
  strength: 'силове',
  flexibility: 'гнучкість',
  other: 'інше',
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

export function Workouts({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [activity, setActivity] = useState('')
  const [minutes, setMinutes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    api.workouts(initData)
      .then(d => { setWorkouts(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function handleAdd() {
    if (!activity.trim()) return
    setSaving(true)
    setSaveErr('')
    try {
      const w = await api.addWorkout(initData, activity.trim(), minutes ? parseInt(minutes, 10) : undefined)
      haptic('success')
      setWorkouts(prev => [w, ...prev].slice(0, 10))
      if (w.xp_granted) push(xpToastText(w.xp_granted))
      setActivity('')
      setMinutes('')
      onDataChange?.()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      {/* Add form */}
      <div className="px-4 py-4 space-y-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <div className="font-condensed font-semibold text-sm">Записати тренування</div>
        {saveErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>}
        <TextField
          border="subtle"
          value={activity}
          onChange={setActivity}
          placeholder="Активність (Біг, Силове, Йога...)"
        />
        <TextField
          border="subtle"
          font="mono"
          inputMode="numeric"
          value={minutes}
          onChange={v => setMinutes(v.replace(/\D/g, ''))}
          placeholder="Хвилини (за бажанням)"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !activity.trim()}
          className="w-full py-3 font-condensed font-semibold text-sm"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving || !activity.trim() ? 0.5 : 1 }}
        >
          Записати
        </button>
        <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
          Тип (кардіо/силове/гнучкість) визначається автоматично за назвою.
        </div>
      </div>

      {/* Recent */}
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        ОСТАННІ
      </div>
      {workouts.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Тренувань поки немає. Запиши перше вище.
        </div>
      )}
      {workouts.map((w, i) => (
        <div key={w.id ?? i} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{TYPE_EMOJI[w.type] ?? '🏋️'}</span>
            <div className="min-w-0">
              <div className="font-condensed text-sm truncate">{w.activity}</div>
              <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{TYPE_LABEL[w.type] ?? w.type}</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {w.duration_min != null && <span className="font-mono text-sm">{w.duration_min} хв</span>}
            <span className="font-mono text-xs ml-2" style={{ color: 'var(--muted)' }}>{fmtDate(w.date)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
