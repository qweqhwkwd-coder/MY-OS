import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Ritual } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

export function Rituals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Ritual | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState('')

  useEffect(() => {
    api.rituals(initData)
      .then(d => { setRituals(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function toggle(id: string) {
    setToggling(id)
    setActionErr('')
    try {
      const res = await api.toggleRitual(initData, id)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, done: res.done } : r))
      onDataChange?.()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteRitual(initData, id)
      setRituals(prev => prev.filter(r => r.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function startEdit(r: Ritual) {
    setOpenId(null)
    setEditItem(r)
    setEditValue(r.title)
  }

  function closeEdit() { setEditItem(null); setEditValue('') }

  async function submitEdit() {
    if (!editItem || !editValue.trim()) { closeEdit(); return }
    setSaving(true)
    try {
      await api.renameRitual(initData, editItem.id, editValue.trim())
      setRituals(prev => prev.map(r => r.id === editItem.id ? { ...r, title: editValue.trim() } : r))
      closeEdit()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  function closeAdd() { setAddOpen(false); setNewTitle(''); setAddErr('') }

  async function handleAdd() {
    if (!newTitle.trim()) return
    setAdding(true)
    setAddErr('')
    try {
      const created = await api.addRitual(initData, newTitle.trim())
      setRituals(prev => [...prev, { ...created, done: false, streak: 0 }])
      closeAdd()
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const done = rituals.filter(r => r.done).length

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between items-center" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>РИТУАЛИ</span>
        <div className="flex items-center gap-3">
          <span>{done}/{rituals.length}</span>
          <button
            onClick={() => setAddOpen(true)}
            className="font-condensed text-xs px-2 py-1"
            style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
          >
            + Ритуал
          </button>
        </div>
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {rituals.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Немає ритуалів. Додай кнопкою вище.
        </div>
      )}

      {rituals.map(r => (
        <SwipeRow
          key={r.id}
          id={r.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(r) },
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(r.id) },
          ]}
          style={{
            borderBottom: '1px solid var(--subtle)',
            background: r.done ? 'var(--subtle)' : 'transparent',
            opacity: toggling === r.id ? 0.5 : 1,
          }}
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <button
              onClick={() => toggle(r.id)}
              disabled={toggling === r.id}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px solid ${r.done ? 'var(--ink)' : 'var(--muted)'}`,
                background: r.done ? 'var(--ink)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {r.done && <span style={{ fontSize: '10px', color: 'var(--bg)' }}>✓</span>}
            </button>
            <span
              className="font-condensed text-sm flex-1 line-clamp-2"
              style={{
                color: 'var(--ink)',
                textDecoration: r.done ? 'line-through' : 'none',
                opacity: r.done ? 0.5 : 1,
              }}
            >
              {r.icon && `${r.icon} `}{r.title}
            </span>
            {r.streak > 0 && (
              <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{r.streak}🔥</span>
            )}
          </div>
        </SwipeRow>
      ))}

      {/* Edit BottomSheet */}
      <BottomSheet open={editItem !== null} onClose={closeEdit}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">✏️ Редагувати ритуал</div>
          <TextField
            autoFocus
            value={editValue}
            onChange={setEditValue}
            onEnter={submitEdit}
            placeholder="Назва ритуалу..."
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

      {/* Add BottomSheet */}
      <BottomSheet open={addOpen} onClose={closeAdd}>
        <div className="p-6 space-y-4">
          {addErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{addErr}</div>}
          <div className="font-condensed font-semibold text-base">🔥 Новий ритуал</div>
          <TextField
            autoFocus
            value={newTitle}
            onChange={setNewTitle}
            onEnter={handleAdd}
            placeholder="Назва ритуалу..."
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: adding ? 0.5 : 1 }}
          >
            Додати
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
