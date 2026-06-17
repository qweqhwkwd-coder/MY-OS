import { useEffect, useState } from 'react'
import { api } from '../api'
import type { TodayData } from '../api'
import { ProgressBar } from '../components/ProgressBar'


export function Today({ initData }: { initData: string }) {
  const [data, setData] = useState<TodayData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.today(initData)
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [initData])

  if (err) return <div className="p-4 text-red-400 text-sm break-all">{err}</div>
  if (!data) return <div className="p-4 text-white/50">Завантаження...</div>

  const waterPct = data.water_goal > 0 ? Math.round((data.water / data.water_goal) * 100) : 0

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📅 Сьогодні</h1>
        <span className="text-sm bg-white/10 px-3 py-1 rounded-full">Рівень {data.level}</span>
      </div>

      {/* Вода */}
      <div className="bg-white/5 rounded-2xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>💧 Вода</span>
          <span>{data.water} / {data.water_goal} мл ({waterPct}%)</span>
        </div>
        <ProgressBar value={data.water} max={data.water_goal} color="bg-blue-400" />
      </div>

      {/* Ритуали */}
      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex justify-between">
          <span>🔥 Ритуали</span>
          <span className="font-bold">{data.rituals_done} / {data.rituals_total}</span>
        </div>
        <ProgressBar value={data.rituals_done} max={data.rituals_total || 1} color="bg-orange-400" />
      </div>

      {/* Завдання */}
      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex justify-between">
          <span>✅ Завдань виконано</span>
          <span className="font-bold">{data.tasks_done}</span>
        </div>
      </div>

      {/* Калорії */}
      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex justify-between">
          <span>🍽 Калорії</span>
          <span className="font-bold">{data.kcal} ккал</span>
        </div>
      </div>
    </div>
  )
}
