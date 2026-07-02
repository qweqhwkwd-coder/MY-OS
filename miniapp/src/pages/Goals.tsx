import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Goal } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { useToast } from '../components/Toast'
import { xpToastText, haptic } from '../utils'

type Tab = 'active' | 'archive'

export function Goals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('active')
  const [goals, setGoals] = useState<Goal[]>([])
  const [archived, setArchived] = useState<Goal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<Goal | null>(null)
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.goals(initData)
      .then(d => { setGoals(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function loadArchive() {
    if (archived !== null) return
    setArchiveLoading(true)
    try {
      setArchived(await api.archivedGoals(initData))
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
      const res = await api.completeGoal(initData, id)
      if (res.done) {
        haptic('success')
        if (res.xp_granted) push(xpToastText(res.xp_granted))
        const done = goals.find(g => g.id === id)
        setGoals(prev => prev.filter(g => g.id !== id))
        if (done) setArchived(prev => prev ? [{ ...done, is_done: true }, ...prev] : null)
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
      await api.deleteGoal(initData, id)
      setGoals(prev => prev.filter(g => g.id !== id))
      setArchived(prev => prev ? prev.filter(g => g.id !== id) : null)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function openAdd() {
    haptic('light')
    setEditItem(null)
    setTitle('')
    setDeadline('')
    setAddOpen(true)
  }

  function startEdit(g: Goal) {
    setOpenId(null)
    setEditItem(g)
    setTitle(g.title)
    setDeadline(g.deadline ?? '')
    setAddOpen(true)
  }

  function closeSheet() {
    setAddOpen(false)
    setEditItem(null)
    setTitle('')
    setDeadline('')
  }

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    setActionErr('')
    try {
      if (editItem) {
        await api.updateGoal(initData, editItem.id, title.trim(), deadline || undefined)
        setGoals(prev => prev.map(g => g.id === editItem.id ? { ...g, title: title.trim(), deadline: deadline || null } : g))
      } else {
        const g = await api.addGoal(initData, title.trim(), deadline || undefined)
        setGoals(prev => [...prev, g])
      }
      closeSheet()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const todayIso = new Date().toISOString().slice(0, 10)
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
            {t === 'active' ? `АКТИВНІ ${goals.length > 0 ? goals.length : ''}` : 'АРХІВ'}
          </button>
        ))}
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {tab === 'active' && (
        <>
          <button
            onClick={openAdd}
            className="w-full px-4 py-3 font-mono text-xs text-left"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', minHeight: '44px' }}
          >
            + НОВА ЦІЛЬ
          </button>

          {goals.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Цілей немає.<br />Додай кнопкою вище або через бот: /addgoal Назва
            </div>
          )}

          {goals.map(g => {
            const overdue = g.deadline != null && g.deadline < todayIso
            return (
              <SwipeRow
                key={g.id}
                id={g.id}
                openId={openId}
                onOpen={setOpenId}
                onClose={() => setOpenId(null)}
                actions={[
                  { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(g) },
                  { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(g.id) },
                ]}
                style={{ borderBottom: '1px solid var(--subtle)' }}
              >
                <div className="flex items-center justify-between px-4 py-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-condensed text-sm line-clamp-2">{g.title}</div>
                    {g.deadline && (
                      <div className="font-mono text-xs mt-1" style={{ color: overdue ? '#dc2626' : 'var(--muted)' }}>
                        ДО {g.deadline}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => complete(g.id)}
                    disabled={completing === g.id}
                    className="press-invert font-mono text-xs px-4 flex-shrink-0"
                    style={{
                      minHeight: '44px',
                      border: '1px solid var(--ink)',
                      background: 'transparent',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      opacity: completing === g.id ? 0.4 : 1,
                    }}
                  >
                    Готово
                  </button>
                </div>
              </SwipeRow>
            )
          })}
        </>
      )}

      {tab === 'archive' && (
        <>
          {archiveLoading && <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>}
          {archived !== null && archived.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Виконаних цілей немає.
            </div>
          )}
          {archived?.map(g => (
            <SwipeRow
              key={g.id}
              id={g.id}
              openId={openId}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
              actions={[
                { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(g.id) },
              ]}
              style={{ borderBottom: '1px solid var(--subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-4 gap-3">
                <span className="font-condensed text-sm flex-1 line-clamp-2" style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>
                  {g.title}
                </span>
                {g.done_at && (
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                    {formatDate(g.done_at)}
                  </span>
                )}
              </div>
            </SwipeRow>
          ))}
        </>
      )}

      {/* Add/Edit BottomSheet */}
      <BottomSheet open={addOpen} onClose={closeSheet}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">
            {editItem ? 'Редагувати ціль' : 'Нова ціль'}
          </div>
          <TextField
            autoFocus
            value={title}
            onChange={setTitle}
            onEnter={submit}
            placeholder="Назва цілі..."
          />
          <TextField
            type="date"
            font="mono"
            border="subtle"
            value={deadline}
            onChange={setDeadline}
          />
          <button
            onClick={submit}
            disabled={saving || !title.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {editItem ? 'Зберегти' : 'Додати'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
