import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Ritual } from '../api'
import { ActionSheet } from '../components/ActionSheet'
import { LongPressButton } from '../components/LongPressButton'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

export function Rituals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [toggleErr, setToggleErr] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
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
    setToggleErr('')
    try {
      const res = await api.toggleRitual(initData, id)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, done: res.done } : r))
      onDataChange?.()
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setToggling(null)
    }
  }

  function startRename(r: Ritual) {
    setMenuId(null)
    setEditingId(r.id)
    setEditValue(r.title)
  }

  async function submitRename() {
    if (!editingId || !editValue.trim()) { setEditingId(null); return }
    const id = editingId
    const title = editValue.trim()
    try {
      await api.renameRitual(initData, id, title)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, title } : r))
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    setMenuId(null)
    try {
      await api.deleteRitual(initData, id)
      setRituals(prev => prev.filter(r => r.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function closeAddModal() {
    setAddOpen(false)
    setNewTitle('')
    setAddErr('')
  }

  async function handleAdd() {
    if (!newTitle.trim()) return
    setAdding(true)
    setAddErr('')
    try {
      const created = await api.addRitual(initData, newTitle.trim())
      setRituals(prev => [...prev, { ...created, done: false, streak: 0 }])
      closeAddModal()
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const done = rituals.filter(r => r.done).length
  const menuRitual = rituals.find(r => r.id === menuId) ?? null

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

      {toggleErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{toggleErr}</div>
      )}

      {rituals.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Немає ритуалів.<br />Додай через бот: /addritual Ранкова зарядка
        </div>
      )}

      <div>
        {rituals.map(r => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-4"
            style={{
              background: r.done ? 'var(--subtle)' : 'transparent',
              borderBottom: '1px solid var(--subtle)',
              opacity: toggling === r.id ? 0.5 : 1,
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
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
              {editingId === r.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitRename()}
                  onBlur={submitRename}
                  className="font-condensed text-sm outline-none flex-1"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}
                />
              ) : (
                <LongPressButton
                  onLongPress={() => setMenuId(r.id)}
                  className="font-condensed text-sm text-left flex-1 truncate"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.5 : 1, color: 'var(--ink)',
                  }}
                >
                  {r.icon && `${r.icon} `}{r.title}
                </LongPressButton>
              )}
            </div>
            {r.streak > 0 && (
              <span className="font-mono text-xs flex-shrink-0 ml-2" style={{ color: 'var(--muted)' }}>{r.streak}🔥</span>
            )}
          </div>
        ))}
      </div>

      <ActionSheet
        open={menuRitual !== null}
        onClose={() => setMenuId(null)}
        items={menuRitual ? [
          { label: 'Перейменувати', onClick: () => startRename(menuRitual) },
          { label: 'Видалити', danger: true, onClick: () => handleDelete(menuRitual.id) },
        ] : []}
      />

      <BottomSheet open={addOpen} onClose={closeAddModal}>
        <div className="p-6 space-y-4">
          {addErr && (
            <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{addErr}</div>
          )}
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
