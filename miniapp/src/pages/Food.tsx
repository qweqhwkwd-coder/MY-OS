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

  if (loading) return <div className="p-4 text-white/50">Завантаження...</div>
  if (err) return <div className="p-4 text-red-400 text-sm">{err}</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">🍽 Харчування</h1>
        <span className="text-sm bg-white/10 px-3 py-1 rounded-full">{total} ккал</span>
      </div>

      {entries.length === 0 && (
        <div className="text-white/50 text-center py-8">
          Нічого не записано.<br />Додай через бот: /addfood Гречка 250
        </div>
      )}

      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
            <span>{e.food_name}{e.grams != null ? ` ${e.grams}г` : ''}</span>
            <span className="text-white/60">{e.kcal} ккал</span>
          </div>
        ))}
      </div>
    </div>
  )
}
