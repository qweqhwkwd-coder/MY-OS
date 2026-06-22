import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DiaryEntry } from '../api'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

export function Diary({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    api.diary(initData)
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function closeModal() {
    setOpen(false)
    setText('')
    setMood(null)
    setSaveErr('')
  }

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    setSaveErr('')
    try {
      const entry = await api.addDiaryEntry(initData, text.trim(), mood ?? undefined)
      setEntries(prev => [entry, ...prev])
      onDataChange?.()
      closeModal()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between items-center" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЩОДЕННИК</span>
        <button
          onClick={() => setOpen(true)}
          className="font-condensed text-xs px-2 py-1"
          style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
        >
          + Новий запис
        </button>
      </div>

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Записів немає.<br />Додай перший запис кнопкою вище.
        </div>
      )}

      <div>
        {entries.map((e, idx) => (
          <div key={idx} className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
            <div className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <span>{e.date}</span>
              {e.mood != null && <span>{MOOD_EMOJI[e.mood]}</span>}
            </div>
            <div className="font-condensed text-sm mt-1">{e.text}</div>
          </div>
        ))}
      </div>

      <BottomSheet open={open} onClose={closeModal}>
        <div className="p-6 space-y-4">
          {saveErr && (
            <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>
          )}
          <div className="font-condensed font-semibold text-base">📓 Новий запис</div>
          <TextField
            autoFocus
            multiline
            value={text}
            onChange={setText}
            placeholder="Як минув день..."
          />
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? null : m)}
                className="flex-1 py-2 text-lg"
                style={{
                  border: '1px solid var(--subtle)',
                  background: mood === m ? 'var(--ink)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !text.trim()}
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
