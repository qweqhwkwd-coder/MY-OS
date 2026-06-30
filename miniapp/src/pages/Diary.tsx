import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DiaryEntry } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

export function Diary({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addText, setAddText] = useState('')
  const [addMood, setAddMood] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [editItem, setEditItem] = useState<DiaryEntry | null>(null)
  const [editText, setEditText] = useState('')
  const [editMood, setEditMood] = useState<number | null>(null)
  const [actionErr, setActionErr] = useState('')

  function loadEntries(date?: string) {
    setLoading(true)
    const req = date ? api.diaryForDate(initData, date) : api.diary(initData)
    req
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }

  useEffect(() => { loadEntries() }, [initData])

  function handleDateChange(d: string) {
    setFilterDate(d)
    loadEntries(d || undefined)
  }

  function closeAdd() { setAddOpen(false); setAddText(''); setAddMood(null); setSaveErr('') }

  async function handleAdd() {
    if (!addText.trim()) return
    setSaving(true)
    setSaveErr('')
    try {
      const entry = await api.addDiaryEntry(initData, addText.trim(), addMood ?? undefined)
      setEntries(prev => [entry, ...prev])
      onDataChange?.()
      closeAdd()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(e: DiaryEntry) {
    setOpenId(null)
    setEditItem(e)
    setEditText(e.text)
    setEditMood(e.mood)
  }

  function closeEdit() { setEditItem(null); setEditText(''); setEditMood(null) }

  async function submitEdit() {
    if (!editItem || !editText.trim()) { closeEdit(); return }
    setSaving(true)
    try {
      await api.updateDiaryEntry(initData, editItem.id, editText.trim(), editMood ?? undefined)
      setEntries(prev => prev.map(e => e.id === editItem.id ? { ...e, text: editText.trim(), mood: editMood } : e))
      closeEdit()
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
      await api.deleteDiaryEntry(initData, id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between items-center gap-2" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЩОДЕННИК</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={e => handleDateChange(e.target.value)}
            className="font-mono text-xs px-2 py-1"
            style={{ border: '1px solid var(--subtle)', background: 'transparent', color: 'var(--muted)', outline: 'none' }}
          />
          <button
            onClick={() => setAddOpen(true)}
            className="font-condensed text-xs px-2 py-1"
            style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
          >
            + Запис
          </button>
        </div>
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          {filterDate ? 'Записів за цю дату немає.' : 'Записів немає. Додай перший запис кнопкою вище.'}
        </div>
      )}

      {entries.map(e => (
        <SwipeRow
          key={e.id}
          id={e.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(e) },
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(e.id) },
          ]}
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <div className="px-4 py-4">
            <div className="font-mono text-xs flex items-center gap-2 mb-1" style={{ color: 'var(--muted)' }}>
              <span>{e.date}</span>
              {e.mood != null && <span>{MOOD_EMOJI[e.mood]}</span>}
            </div>
            <div className="font-condensed text-sm">{e.text}</div>
          </div>
        </SwipeRow>
      ))}

      {/* Add BottomSheet */}
      <BottomSheet open={addOpen} onClose={closeAdd}>
        <div className="p-6 space-y-4">
          {saveErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>}
          <div className="font-condensed font-semibold text-base">📓 Новий запис</div>
          <TextField autoFocus multiline value={addText} onChange={setAddText} placeholder="Як минув день..." />
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setAddMood(addMood === m ? null : m)}
                className="flex-1 py-2 text-lg"
                style={{ border: '1px solid var(--subtle)', background: addMood === m ? 'var(--ink)' : 'transparent', cursor: 'pointer' }}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !addText.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            Зберегти
          </button>
        </div>
      </BottomSheet>

      {/* Edit BottomSheet */}
      <BottomSheet open={editItem !== null} onClose={closeEdit}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">✏️ Редагувати запис</div>
          <TextField autoFocus multiline value={editText} onChange={setEditText} placeholder="Текст запису..." />
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setEditMood(editMood === m ? null : m)}
                className="flex-1 py-2 text-lg"
                style={{ border: '1px solid var(--subtle)', background: editMood === m ? 'var(--ink)' : 'transparent', cursor: 'pointer' }}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
          <button
            onClick={submitEdit}
            disabled={saving || !editText.trim()}
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
