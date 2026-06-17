import { useEffect, useState } from 'react'
import { api } from '../api'
import { ProgressBar } from '../components/ProgressBar'

const AMOUNTS = [250, 500, 1000]

export function Water({ initData }: { initData: string }) {
  const [total, setTotal] = useState(0)
  const goal = 2000
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.water(initData).then(d => { setTotal(d.total); setLoading(false) })
  }, [initData])

  async function add(amount: number) {
    setAdding(true)
    try {
      const d = await api.addWater(initData, amount)
      setTotal(d.total)
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-4 text-white/50">Завантаження...</div>

  const pct = Math.round((total / goal) * 100)

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold">💧 Вода</h1>

      <div className="bg-white/5 rounded-2xl p-6 text-center space-y-4">
        <div className="text-5xl font-bold">{total}</div>
        <div className="text-white/50">з {goal} мл</div>
        <ProgressBar value={total} max={goal} color="bg-blue-400" />
        <div className="text-sm text-white/60">{pct}% від цілі</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {AMOUNTS.map(a => (
          <button
            key={a}
            onClick={() => add(a)}
            disabled={adding}
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 rounded-2xl py-4 text-lg font-bold transition-colors"
          >
            +{a}
          </button>
        ))}
      </div>

      {total >= goal && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-2xl p-4 text-center text-green-400">
          🎉 Ціль виконана!
        </div>
      )}
    </div>
  )
}
