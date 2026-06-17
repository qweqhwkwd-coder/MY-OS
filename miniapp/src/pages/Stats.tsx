import { useEffect, useState } from 'react'
import { api } from '../api'
import type { StatsData } from '../api'
import { ProgressBar } from '../components/ProgressBar'

const STATS = [
  { key: 'strength', label: '💪 Сила', color: 'bg-red-400' },
  { key: 'endurance', label: '🏃 Витривалість', color: 'bg-orange-400' },
  { key: 'nutrition', label: '🥗 Харчування', color: 'bg-green-400' },
  { key: 'discipline', label: '🔥 Дисципліна', color: 'bg-yellow-400' },
  { key: 'reflection', label: '🧘 Рефлексія', color: 'bg-purple-400' },
  { key: 'health', label: '❤️ Здоров\'я', color: 'bg-pink-400' },
  { key: 'finance', label: '💰 Фінанси', color: 'bg-emerald-400' },
  { key: 'intellect', label: '🧠 Інтелект', color: 'bg-blue-400' },
]

export function Stats({ initData }: { initData: string }) {
  const [data, setData] = useState<StatsData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.stats(initData).then(setData).catch(() => setErr('Помилка завантаження'))
  }, [initData])

  if (err) return <div className="p-4 text-red-400">{err}</div>
  if (!data) return <div className="p-4 text-white/50">Завантаження...</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">⚔️ RPG-стати</h1>
        <span className="text-sm bg-white/10 px-3 py-1 rounded-full">Рівень {data.level}</span>
      </div>

      <div className="space-y-3">
        {STATS.map(({ key, label, color }) => {
          const xp = data[key as keyof StatsData] as number
          const lvl = Math.floor(xp / 100)
          const progress = xp % 100
          return (
            <div key={key} className="bg-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="text-white/60">lv{lvl}  ·  {xp} XP</span>
              </div>
              <ProgressBar value={progress} max={100} color={color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
