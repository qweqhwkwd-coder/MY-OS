import { useEffect, useState } from 'react'
import { api } from '../api'
import type { InboxItem } from '../api'
import { ActionSheet } from '../components/ActionSheet'
import { LongPressButton } from '../components/LongPressButton'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

export function Notes({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
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
    setMenuId(null)
    setActionErr('')
    try {
      await action()
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function openMeetingForm(id: string) {
    setMenuId(null)
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

  const menuItem = items.find(i => i.id === menuId) ?? null

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>НОТАТКИ</span>
        <span>{items.length}</span>
      </div>

      {actionErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>
      )}

      {items.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нотаток немає.<br />Додай кнопкою «Нотатку» на головній.
        </div>
      )}

      <div>
        {items.map(i => (
          <LongPressButton
            key={i.id}
            onLongPress={() => setMenuId(i.id)}
            className="w-full text-left px-4 py-4"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', cursor: 'pointer' }}
          >
            <div className="font-condensed text-sm">{i.text}</div>
            <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {new Date(i.created_at).toLocaleDateString('uk-UA')}
            </div>
          </LongPressButton>
        ))}
      </div>

      <ActionSheet
        open={menuItem !== null}
        onClose={() => setMenuId(null)}
        items={menuItem ? [
          { label: '→ Завдання', onClick: () => run(() => api.inboxToTask(initData, menuItem.id), menuItem.id) },
          { label: '→ Щоденник', onClick: () => run(() => api.inboxToDiary(initData, menuItem.id), menuItem.id) },
          { label: '→ Ідея', onClick: () => run(() => api.inboxToIdea(initData, menuItem.id), menuItem.id) },
          { label: '→ Зустріч', onClick: () => openMeetingForm(menuItem.id) },
          { label: 'Видалити', danger: true, onClick: () => run(() => api.deleteInboxItem(initData, menuItem.id), menuItem.id) },
        ] : []}
      />

      <BottomSheet open={meetingId !== null} onClose={() => setMeetingId(null)}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">📅 Зустріч — дата</div>
          <TextField
            autoFocus
            type="date"
            font="mono"
            value={meetingDate}
            onChange={setMeetingDate}
          />
          <TextField
            type="time"
            font="mono"
            border="subtle"
            value={meetingTime}
            onChange={setMeetingTime}
          />
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
