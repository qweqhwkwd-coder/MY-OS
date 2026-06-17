import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Ritual } from '../api'

export function Rituals({ initData }: { initData: string }) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.rituals(initData).then(d => { setRituals(d); setLoading(false) })
  }, [initData])

  async function toggle(id: string) {
    const res = await api.toggleRitual(initData, id)
    setRituals(prev => prev.map(r => r.id === id ? { ...r, done: res.done } : r))
  }

  if (loading) return <div className="p-4 text-white/50">Завантаження...</div>

  const done = rituals.filter(r => r.done).length

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">🔥 Ритуали</h1>
        <span className="text-sm bg-white/10 px-3 py-1 rounded-full">{done}/{rituals.length}</span>
      </div>

      {rituals.length === 0 && (
        <div className="text-white/50 text-center py-8">
          Ритуалів немає.<br />Додай через бот: /addritual Медитація
        </div>
      )}

      <div className="space-y-2">
        {rituals.map(r => (
          <button
            key={r.id}
            onClick={() => toggle(r.id)}
            className={`w-full text-left rounded-2xl p-4 flex items-center justify-between transition-colors ${
              r.done ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{r.done ? '✅' : '⬜'}</span>
              <span>{r.icon ? `${r.icon} ` : ''}{r.title}</span>
            </div>
            <span className="text-sm text-white/40">{r.streak}/7</span>
          </button>
        ))}
      </div>
    </div>
  )
}
