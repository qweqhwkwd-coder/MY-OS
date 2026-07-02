import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { useToast } from '../components/Toast'
import { xpToastText } from '../utils'

type Tab = 'active' | 'archive'

export function Tasks({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('active')
  const [tasks, setTasks] = useState<Task[]>([])
  const [archived, setArchived] = useState<Task[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [err, setErr] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Task | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.tasks(initData)
      .then(d => { setTasks(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function loadArchive() {
    if (archived !== null) return
    setArchiveLoading(true)
    try {
      const d = await api.archivedTasks(initData)
      setArchived(d)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setArchiveLoading(false)
    }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setOpenId(null)
    setActionErr('')
    if (t === 'archive') loadArchive()
  }

  async function complete(id: string) {
    setCompleting(id)
    setActionErr('')
    try {
      const res = await api.completeTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      if (res.done) {
        if (res.xp_granted) push(xpToastText(res.xp_granted))
        onDataChange?.()
      }
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setCompleting(null)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      setArchived(prev => prev ? prev.filter(t => t.id !== id) : null)
      onDataChange?.()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function startEdit(t: Task) {
    setOpenId(null)
    setEditItem(t)
    setEditValue(t.title)
  }

  function closeEdit() {
    setEditItem(null)
    setEditValue('')
  }

  async function submitEdit() {
    if (!editItem || !editValue.trim()) { closeEdit(); return }
    setSaving(true)
    try {
      await api.renameTask(initData, editItem.id, editValue.trim())
      setTasks(prev => prev.map(t => t.id === editItem.id ? { ...t, title: editValue.trim() } : t))
      closeEdit()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })

  return (
    <div style={{ color: 'var(--ink)' }}>
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--subtle)' }}>
        {(['active', 'archive'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className="flex-1 py-2 font-mono text-xs"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--ink)' : '2px solid transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {t === 'active' ? `АКТИВНІ ${tasks.length > 0 ? tasks.length : ''}` : 'АРХІВ'}
          </button>
        ))}
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {/* Active tab */}
      {tab === 'active' && (
        <>
          {tasks.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Задач немає.<br />Додай через бот або кнопку «Задачу» на головній.
            </div>
          )}
          {tasks.map(t => (
            <SwipeRow
              key={t.id}
              id={t.id}
              openId={openId}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
              actions={[
                { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(t) },
                { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(t.id) },
              ]}
              style={{ borderBottom: '1px solid var(--subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-4 gap-3">
                <span
                  className="font-condensed text-sm flex-1 line-clamp-2"
                  style={{ color: 'var(--ink)' }}
                >
                  {t.title}
                </span>
                <button
                  onClick={() => complete(t.id)}
                  disabled={completing === t.id}
                  className="font-mono text-xs px-3 py-1 flex-shrink-0"
                  style={{
                    border: '1px solid var(--ink)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    opacity: completing === t.id ? 0.4 : 1,
                  }}
                >
                  Готово
                </button>
              </div>
            </SwipeRow>
          ))}
        </>
      )}

      {/* Archive tab */}
      {tab === 'archive' && (
        <>
          {archiveLoading && <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>}
          {archived !== null && archived.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Виконаних задач за останні 30 днів немає.
            </div>
          )}
          {archived?.map(t => (
            <SwipeRow
              key={t.id}
              id={t.id}
              openId={openId}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
              actions={[
                { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(t.id) },
              ]}
              style={{ borderBottom: '1px solid var(--subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-4 gap-3">
                <span className="font-condensed text-sm flex-1 line-clamp-2" style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>
                  {t.title}
                </span>
                {t.completed_at && (
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                    {formatDate(t.completed_at)}
                  </span>
                )}
              </div>
            </SwipeRow>
          ))}
        </>
      )}

      {/* Edit BottomSheet */}
      <BottomSheet open={editItem !== null} onClose={closeEdit}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">✏️ Редагувати завдання</div>
          <TextField
            autoFocus
            value={editValue}
            onChange={setEditValue}
            onEnter={submitEdit}
            placeholder="Назва завдання..."
          />
          <button
            onClick={submitEdit}
            disabled={saving || !editValue.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            Зберегти
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
