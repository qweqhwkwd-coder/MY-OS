import { useEffect, useState } from 'react'
import { api } from '../api'
import type { InboxItem } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

export function Notes({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [optionsItem, setOptionsItem] = useState<InboxItem | null>(null)
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')

  useEffect(() => {
    api.inbox(initData)
      .then(d => { setItems(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    onDataChange?.()
  }

  async function run(action: () => Promise<unknown>, id: string) {
    setOptionsItem(null)
    setActionErr('')
    try {
      await action()
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteInboxItem(initData, id)
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function openOptions(item: InboxItem) {
    setOpenId(null)
    setOptionsItem(item)
  }

  function openMeetingForm(id: string) {
    setOptionsItem(null)
    setMeetingId(id)
    setMeetingDate('')
    setMeetingTime('')
  }

  async function submitMeeting() {
    if (!meetingId || !meetingDate) return
    const id = meetingId
    setActionErr('')
    try {
      await api.inboxToMeeting(initData, id, meetingDate, meetingTime || undefined)
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setMeetingId(null)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>УСЬОГО</span>
        <span>{items.length}</span>
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {items.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нотаток немає.<br />Додай кнопкою «Нотатку» на головній.
        </div>
      )}

      {items.map(i => (
        <SwipeRow
          key={i.id}
          id={i.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Опції', bgColor: '#374151', onClick: () => openOptions(i) },
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

      {/* Options BottomSheet */}
      <BottomSheet open={optionsItem !== null} onClose={() => setOptionsItem(null)}>
        {optionsItem && (
          <div className="p-6 space-y-2">
            <div className="font-condensed font-semibold text-base mb-3">Конвертувати в...</div>
            {[
              { label: '→ Завдання', action: () => run(() => api.inboxToTask(initData, optionsItem.id), optionsItem.id) },
              { label: '→ Щоденник', action: () => run(() => api.inboxToDiary(initData, optionsItem.id), optionsItem.id) },
              { label: '→ Ідея', action: () => run(() => api.inboxToIdea(initData, optionsItem.id), optionsItem.id) },
              { label: '→ Зустріч', action: () => openMeetingForm(optionsItem.id) },
            ].map(opt => (
              <button
                key={opt.label}
                onClick={opt.action}
                className="w-full py-3 font-condensed text-sm text-left px-3"
                style={{ background: 'var(--subtle)', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* Meeting BottomSheet */}
      <BottomSheet open={meetingId !== null} onClose={() => setMeetingId(null)}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">📅 Зустріч — дата</div>
          <TextField autoFocus type="date" font="mono" value={meetingDate} onChange={setMeetingDate} />
          <TextField type="time" font="mono" border="subtle" value={meetingTime} onChange={setMeetingTime} />
          <button
            onClick={submitMeeting}
            disabled={!meetingDate}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: meetingDate ? 1 : 0.5 }}
          >
            Створити зустріч
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
