import { useEffect, useState } from 'react'
import { api } from '../api'
import type { SleepEntry } from '../api'
import { TextField } from '../components/TextField'
import { useToast } from '../components/Toast'
import { xpToastText } from '../utils'

function fmtDuration(min: number): string {
  return `${Math.floor(min / 60)}г ${min % 60}хв`
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Postgres TIME повертається як "23:30:00" — секунди в UI не потрібні
function fmtTime(t: string): string {
  return t.slice(0, 5)
}

function validTime(s: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return false
  return parseInt(m[1], 10) <= 23 && parseInt(m[2], 10) <= 59
}

export function Sleep({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [today, setToday] = useState<SleepEntry | null>(null)
  const [history, setHistory] = useState<SleepEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [sleepTime, setSleepTime] = useState('')
  const [wakeTime, setWakeTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    api.sleep(initData)
      .then(d => { setToday(d.today); setHistory(d.history); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  const timesValid = validTime(sleepTime) && validTime(wakeTime)

  async function handleSave() {
    if (!timesValid) return
    setSaving(true)
    setSaveErr('')
    try {
      const entry = await api.logSleep(initData, sleepTime.trim(), wakeTime.trim())
      setToday(entry)
      setHistory(prev => [entry, ...prev.filter(h => h.date !== entry.date)].slice(0, 7))
      if (entry.xp_granted) push(xpToastText(entry.xp_granted))
      setSleepTime('')
      setWakeTime('')
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
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        СЬОГОДНІ
      </div>

      {/* Today */}
      <div className="px-4 py-6 space-y-1" style={{ borderBottom: '1px solid var(--subtle)' }}>
        {today ? (
          <>
            <div className="font-condensed font-bold text-4xl">{fmtDuration(today.duration_min)}</div>
            <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
              {fmtTime(today.sleep_time)} → {fmtTime(today.wake_time)}
              {today.duration_min >= 420 && today.duration_min <= 540 ? ' · норма 7–9г ✓' : ''}
            </div>
          </>
        ) : (
          <div className="font-condensed text-sm" style={{ color: 'var(--muted)' }}>
            Сон за сьогодні ще не записано.
          </div>
        )}
      </div>

      {/* Log form */}
      <div className="px-4 py-4 space-y-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <div className="font-condensed font-semibold text-sm">😴 Записати сон</div>
        {saveErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="font-condensed text-xs" style={{ color: 'var(--muted)' }}>Заснув</div>
            <TextField border="subtle" font="mono" value={sleepTime} onChange={setSleepTime} placeholder="23:30" />
          </div>
          <div className="space-y-1">
            <div className="font-condensed text-xs" style={{ color: 'var(--muted)' }}>Прокинувся</div>
            <TextField border="subtle" font="mono" value={wakeTime} onChange={setWakeTime} placeholder="07:15" />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !timesValid}
          className="w-full py-3 font-condensed font-semibold text-sm"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving || !timesValid ? 0.5 : 1 }}
        >
          {today ? 'Перезаписати' : 'Записати'}
        </button>
      </div>

      {/* History */}
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        ОСТАННІ ЗАПИСИ
      </div>
      {history.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Історії сну поки немає.
        </div>
      )}
      {history.map(h => (
        <div key={h.date} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <span className="font-condensed text-sm">{fmtDate(h.date)}</span>
          <div className="text-right">
            <span className="font-mono text-sm">{fmtDuration(h.duration_min)}</span>
            <span className="font-mono text-xs ml-2" style={{ color: 'var(--muted)' }}>{fmtTime(h.sleep_time)}→{fmtTime(h.wake_time)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
