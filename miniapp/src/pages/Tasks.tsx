import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../api'

export function Tasks({ initData }: { initData: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [completeErr, setCompleteErr] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    api.tasks(initData)
      .then(d => { setTasks(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function complete(id: string) {
    setCompleting(id)
    setCompleteErr('')
    try {
      await api.completeTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setCompleting(null)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЗАВДАННЯ</span>
        <span>{tasks.length}</span>
      </div>

      {completeErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{completeErr}</div>
      )}

      {tasks.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Задач немає.<br />Додай через бот або кнопку «Задачу» на головній.
        </div>
      )}

      <div>
        {tasks.map(t => (
          <div
            key={t.id}
            className="flex items-center justify-between px-4 py-4"
            style={{ borderBottom: '1px solid var(--subtle)' }}
          >
            <span className="font-condensed text-sm flex-1 mr-3">{t.title}</span>
            <button
              onClick={() => complete(t.id)}
              disabled={completing === t.id}
              className="font-mono text-xs px-3 py-1"
              style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', opacity: completing === t.id ? 0.4 : 1 }}
            >
              Готово
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
