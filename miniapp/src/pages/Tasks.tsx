import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../api'

export function Tasks({ initData }: { initData: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [completeErr, setCompleteErr] = useState('')

  useEffect(() => {
    api.tasks(initData)
      .then(d => { setTasks(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function complete(id: string) {
    setCompleteErr('')
    try {
      await api.completeTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setCompleteErr((e as Error).message || 'Помилка. Спробуй ще раз.')
    }
  }

  if (loading) return <div className="p-4 text-white/50">Завантаження...</div>
  if (err) return <div className="p-4 text-red-400 text-sm">{err}</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">✅ Завдання</h1>
      {completeErr && <div className="text-red-400 text-sm px-1">{completeErr}</div>}

      {tasks.length === 0 && (
        <div className="text-white/50 text-center py-8">
          Активних завдань немає.<br />Додай через бот: /addtask Назва
        </div>
      )}

      <div className="space-y-2">
        {tasks.map(t => (
          <button
            key={t.id}
            onClick={() => complete(t.id)}
            className="w-full text-left rounded-2xl p-4 bg-white/5 hover:bg-white/10 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">⬜</span>
            <span>{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
