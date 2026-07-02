import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DigestData } from '../api'

export function Digest({ initData }: { initData: string }) {
  const [data, setData] = useState<DigestData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.digest(initData).then(setData).catch((e: Error) => setErr(e.message))
  }, [initData])

  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>
  if (!data) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>

  const rows: { label: string; value: string }[] = [
    { label: 'Вода', value: `${data.water_total} мл · ${data.water_days} дн` },
    { label: 'Ритуали', value: `${data.rituals_done}` },
    { label: 'Завдання', value: `${data.tasks_done}` },
    { label: 'Калорії', value: `${data.kcal_avg} / день` },
    { label: 'Сон', value: `${data.sleep_avg_h.toFixed(1)} год / ніч` },
    { label: 'Тренування', value: `${data.workouts}` },
    { label: 'Витрати', value: `${data.spend_total} грн` },
  ]

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        ДАЙДЖЕСТ — ОСТАННІ 7 ДНІВ
      </div>

      {rows.map(r => (
        <div
          key={r.label}
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <span className="font-condensed text-sm">{r.label}</span>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.value}</span>
        </div>
      ))}

      <div className="flex items-center justify-between px-4 py-5" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <span className="font-condensed font-semibold text-sm">XP за тиждень</span>
        <span className="font-mono font-semibold text-sm" style={{ color: 'var(--accent)' }}>+{data.xp_earned}</span>
      </div>
    </div>
  )
}
