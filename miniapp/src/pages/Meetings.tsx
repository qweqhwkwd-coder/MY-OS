import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Meeting } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { haptic } from '../utils'

function sortMeetings(list: Meeting[]): Meeting[] {
  return [...list].sort((a, b) =>
    a.date === b.date ? (a.time ?? '99:99').localeCompare(b.time ?? '99:99') : a.date.localeCompare(b.date))
}

export function Meetings({ initData }: { initData: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<Meeting | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.meetings(initData)
      .then(d => { setMeetings(sortMeetings(d)); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function openAdd() {
    haptic('light')
    setEditItem(null)
    setTitle('')
    setDate('')
    setTime('')
    setSheetOpen(true)
  }

  function startEdit(m: Meeting) {
    setOpenId(null)
    setEditItem(m)
    setTitle(m.title)
    setDate(m.date)
    setTime(m.time ? m.time.slice(0, 5) : '')
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditItem(null)
    setTitle('')
    setDate('')
    setTime('')
  }

  async function submit() {
    if (!title.trim() || !date) return
    setSaving(true)
    setActionErr('')
    try {
      if (editItem) {
        await api.updateMeeting(initData, editItem.id, title.trim(), date, time || undefined)
        setMeetings(prev => sortMeetings(prev.map(m =>
          m.id === editItem.id ? { ...m, title: title.trim(), date, time: time || null } : m)))
      } else {
        const m = await api.addMeeting(initData, title.trim(), date, time || undefined)
        setMeetings(prev => sortMeetings([...prev, m]))
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
      await api.deleteMeeting(initData, id)
      setMeetings(prev => prev.filter(m => m.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  const todayIso = new Date().toISOString().slice(0, 10)
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const dateLabel = (d: string) => {
    if (d === todayIso) return 'СЬОГОДНІ'
    if (d === tomorrowIso) return 'ЗАВТРА'
    return new Date(`${d}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }).toUpperCase()
  }

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>НАЙБЛИЖЧІ ЗУСТРІЧІ</span>
        <span>{meetings.length}</span>
      </div>

      <button
        onClick={openAdd}
        className="w-full px-4 py-3 font-mono text-xs text-left"
        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', minHeight: '44px' }}
      >
        + НОВА ЗУСТРІЧ
      </button>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {meetings.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Зустрічей немає.<br />Додай кнопкою вище або через бот: /addmeeting
        </div>
      )}

      {meetings.map(m => {
        const isToday = m.date === todayIso
        return (
          <SwipeRow
            key={m.id}
            id={m.id}
            openId={openId}
            onOpen={setOpenId}
            onClose={() => setOpenId(null)}
            actions={[
              { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(m) },
              { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(m.id) },
            ]}
            style={{ borderBottom: '1px solid var(--subtle)' }}
          >
            <div className="flex items-center justify-between px-4 py-4 gap-3">
              <span className="font-condensed text-sm flex-1 line-clamp-2">{m.title}</span>
              <span
                className="font-mono text-xs flex-shrink-0 text-right"
                style={{ color: isToday ? 'var(--ink)' : 'var(--muted)', fontWeight: isToday ? 600 : 400 }}
              >
                {dateLabel(m.date)}{m.time ? ` · ${m.time.slice(0, 5)}` : ''}
              </span>
            </div>
          </SwipeRow>
        )
      })}

      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">
            {editItem ? 'Редагувати зустріч' : 'Нова зустріч'}
          </div>
          <TextField
            autoFocus
            value={title}
            onChange={setTitle}
            placeholder="Назва зустрічі..."
          />
          <TextField type="date" font="mono" border="subtle" value={date} onChange={setDate} />
          <TextField type="time" font="mono" border="subtle" value={time} onChange={setTime} />
          <button
            onClick={submit}
            disabled={saving || !title.trim() || !date}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving || !title.trim() || !date ? 0.5 : 1 }}
          >
            {editItem ? 'Зберегти' : 'Додати'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
