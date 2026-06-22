import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../api'
import { ActionSheet } from '../components/ActionSheet'
import { LongPressButton } from '../components/LongPressButton'

export function Tasks({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [completeErr, setCompleteErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    api.tasks(initData)
      .then(d => { setTasks(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function complete(id: string) {
    setCompleting(id)
    setCompleteErr('')
    setSuccessMsg('')
    try {
      const { done } = await api.completeTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      if (done) {
        setSuccessMsg('+3 XP до Дисципліни')
        onDataChange?.()
      } else {
        setCompleteErr('Вже виконано — XP за цю задачу вже нараховано раніше')
      }
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setCompleting(null)
    }
  }

  function startRename(t: Task) {
    setMenuId(null)
    setEditingId(t.id)
    setEditValue(t.title)
  }

  async function submitRename() {
    if (!editingId || !editValue.trim()) { setEditingId(null); return }
    const id = editingId
    const title = editValue.trim()
    try {
      await api.renameTask(initData, id, title)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t))
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    setMenuId(null)
    try {
      await api.deleteTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const menuTask = tasks.find(t => t.id === menuId) ?? null

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЗАВДАННЯ</span>
        <span>{tasks.length}</span>
      </div>

      {completeErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{completeErr}</div>
      )}
      {successMsg && (
        <div className="px-4 py-2 text-xs font-mono" style={{ color: 'var(--accent)' }}>{successMsg}</div>
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
            {editingId === t.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitRename()}
                onBlur={submitRename}
                className="font-condensed text-sm outline-none flex-1 mr-3"
                style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}
              />
            ) : (
              <LongPressButton
                onLongPress={() => setMenuId(t.id)}
                className="font-condensed text-sm flex-1 mr-3 text-left truncate"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
              >
                {t.title}
              </LongPressButton>
            )}
            <button
              onClick={() => complete(t.id)}
              disabled={completing === t.id}
              className="font-mono text-xs px-3 py-1 flex-shrink-0"
              style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', opacity: completing === t.id ? 0.4 : 1 }}
            >
              Готово
            </button>
          </div>
        ))}
      </div>

      <ActionSheet
        open={menuTask !== null}
        onClose={() => setMenuId(null)}
        items={menuTask ? [
          { label: 'Перейменувати', onClick: () => startRename(menuTask) },
          { label: 'Видалити', danger: true, onClick: () => handleDelete(menuTask.id) },
        ] : []}
      />
    </div>
  )
}
