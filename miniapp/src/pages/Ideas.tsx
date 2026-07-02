import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Idea } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { haptic } from '../utils'

export function Ideas({ initData }: { initData: string }) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<Idea | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.ideas(initData)
      .then(d => { setIdeas(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function openAdd() {
    haptic('light')
    setEditItem(null)
    setText('')
    setSheetOpen(true)
  }

  function startEdit(i: Idea) {
    setOpenId(null)
    setEditItem(i)
    setText(i.text)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditItem(null)
    setText('')
  }

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    setActionErr('')
    try {
      if (editItem) {
        await api.updateIdea(initData, editItem.id, text.trim())
        setIdeas(prev => prev.map(i => i.id === editItem.id ? { ...i, text: text.trim() } : i))
      } else {
        const idea = await api.addIdea(initData, text.trim())
        setIdeas(prev => [idea, ...prev])
      }
      closeSheet()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteIdea(initData, id)
      setIdeas(prev => prev.filter(i => i.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ІДЕЇ</span>
        <span>{ideas.length}</span>
      </div>

      <button
        onClick={openAdd}
        className="w-full px-4 py-3 font-mono text-xs text-left"
        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', minHeight: '44px' }}
      >
        + НОВА ІДЕЯ
      </button>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {ideas.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Ідей немає.<br />Додай кнопкою вище або через бот: /idea Текст
        </div>
      )}

      {ideas.map(i => (
        <SwipeRow
          key={i.id}
          id={i.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(i) },
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(i.id) },
          ]}
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <div className="px-4 py-4">
            <div className="font-condensed text-sm line-clamp-2">{i.text}</div>
            <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {new Date(i.created_at).toLocaleDateString('uk-UA')}
            </div>
          </div>
        </SwipeRow>
      ))}

      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">
            {editItem ? 'Редагувати ідею' : 'Нова ідея'}
          </div>
          <TextField
            autoFocus
            multiline
            rows={3}
            value={text}
            onChange={setText}
            placeholder="Запиши ідею..."
          />
          <button
            onClick={submit}
            disabled={saving || !text.trim()}
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
