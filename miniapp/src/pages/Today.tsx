import { useEffect, useState } from 'react'
import { api } from '../api'
import type { TodayData } from '../api'

type Modal = 'water' | 'task' | 'note' | 'food' | null

const QUICK_BUTTONS: { id: Modal; icon: string; label: string }[] = [
  { id: 'water', icon: '💧', label: 'ВОДУ' },
  { id: 'task',  icon: '✅', label: 'ЗАДАЧУ' },
  { id: 'note',  icon: '📋', label: 'НОТАТКУ' },
  { id: 'food',  icon: '🍽', label: 'ЇЖУ' },
]

export function Today({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [data, setData] = useState<TodayData | null>(null)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [foodName, setFoodName] = useState('')
  const [foodKcal, setFoodKcal] = useState('')

  function reload() {
    api.today(initData).then(setData).catch((e: Error) => setErr(e.message))
  }

  useEffect(() => { reload() }, [initData])

  function closeModal() {
    setModal(null)
    setSaveErr('')
    setTaskTitle('')
    setNoteText('')
    setFoodName('')
    setFoodKcal('')
  }

  async function handleAddWater(amount: number) {
    setSaving(true)
    setSaveErr('')
    try { await api.addWater(initData, amount); reload(); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return
    setSaving(true)
    setSaveErr('')
    try { await api.addTask(initData, taskTitle.trim()); reload(); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSaving(true)
    setSaveErr('')
    try { await api.addNote(initData, noteText.trim()); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  async function handleAddFood() {
    if (!foodName.trim() || !foodKcal) return
    setSaving(true)
    setSaveErr('')
    try { await api.addFoodEntry(initData, foodName.trim(), parseInt(foodKcal)); reload(); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>
  if (!data) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>

  const waterPct = data.water_goal > 0 ? Math.round((data.water / data.water_goal) * 100) : 0
  const ritualPct = data.rituals_total > 0 ? Math.round((data.rituals_done / data.rituals_total) * 100) : 0

  return (
    <div style={{ color: 'var(--ink)' }}>
      {/* Quick-add */}
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        ШВИДКО ДОДАТИ
      </div>
      <div className="grid grid-cols-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
        {QUICK_BUTTONS.map((btn, idx) => (
          <button
            key={btn.id}
            onClick={() => setModal(btn.id)}
            className="flex flex-col items-center gap-1 py-4"
            style={{ background: 'transparent', border: 'none', borderRight: idx < QUICK_BUTTONS.length - 1 ? '1px solid var(--subtle)' : 'none', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{btn.icon}</span>
            <span className="font-condensed text-xs" style={{ color: 'var(--muted)' }}>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Digest rows */}
      <div>
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>ВОДА</span>
            <div className="text-right">
              <span className="font-condensed font-bold text-xl">{data.water}</span>
              <span className="font-mono text-xs ml-1" style={{ color: 'var(--muted)' }}>з {data.water_goal} мл</span>
            </div>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: 'var(--subtle)' }}>
            <div className="h-1 rounded-full transition-all" style={{ width: `${waterPct}%`, background: '#3b82f6' }} />
          </div>
        </div>

        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>РИТУАЛИ</span>
            <div className="text-right">
              <span className="font-condensed font-bold text-xl">{data.rituals_done}/{data.rituals_total}</span>
              <span className="font-mono text-xs ml-1" style={{ color: 'var(--muted)' }}>{ritualPct}%</span>
            </div>
          </div>
          <div className="w-full h-1 rounded-full" style={{ background: 'var(--subtle)' }}>
            <div className="h-1 rounded-full transition-all" style={{ width: `${ritualPct}%`, background: '#f97316' }} />
          </div>
        </div>

        <div className="px-4 py-4 flex items-baseline justify-between" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>ЗАВДАННЯ</span>
          <div className="text-right">
            <span className="font-condensed font-bold text-xl">{data.tasks_done}</span>
            <span className="font-mono text-xs ml-1" style={{ color: 'var(--muted)' }}>виконано</span>
          </div>
        </div>

        <div className="px-4 py-4 flex items-baseline justify-between">
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>КАЛОРІЇ</span>
          <div className="text-right">
            <span className="font-condensed font-bold text-xl">{data.kcal}</span>
            <span className="font-mono text-xs ml-1" style={{ color: 'var(--muted)' }}>ккал</span>
          </div>
        </div>
      </div>

      {/* Quick-add modal */}
      {modal && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(26,26,26,0.6)' }}
          onClick={closeModal}
        >
          <div
            className="w-full p-6 space-y-4"
            style={{ background: 'var(--bg)', borderTop: '1px solid var(--subtle)' }}
            onClick={e => e.stopPropagation()}
          >
            {saveErr && (
              <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>
            )}

            {modal === 'water' && (
              <>
                <div className="font-condensed font-semibold text-base">💧 Додати воду</div>
                <div className="grid grid-cols-3 gap-3">
                  {[250, 500, 1000].map(ml => (
                    <button
                      key={ml}
                      onClick={() => handleAddWater(ml)}
                      disabled={saving}
                      className="py-4 font-mono text-sm"
                      style={{ border: '1px solid var(--subtle)', background: 'transparent', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                    >
                      +{ml} мл
                    </button>
                  ))}
                </div>
              </>
            )}

            {modal === 'task' && (
              <>
                <div className="font-condensed font-semibold text-base">✅ Нова задача</div>
                <input
                  autoFocus
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                  placeholder="Назва задачі..."
                  className="w-full px-0 py-3 font-condensed text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <button
                  onClick={handleAddTask}
                  disabled={saving || !taskTitle.trim()}
                  className="w-full py-3 font-condensed font-semibold text-sm"
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  Додати
                </button>
              </>
            )}

            {modal === 'note' && (
              <>
                <div className="font-condensed font-semibold text-base">📝 Нова нотатка</div>
                <textarea
                  autoFocus
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Запиши думку..."
                  rows={3}
                  className="w-full px-0 py-3 font-condensed text-sm outline-none resize-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <button
                  onClick={handleAddNote}
                  disabled={saving || !noteText.trim()}
                  className="w-full py-3 font-condensed font-semibold text-sm"
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  Зберегти
                </button>
              </>
            )}

            {modal === 'food' && (
              <>
                <div className="font-condensed font-semibold text-base">🍽 Їжа</div>
                <input
                  autoFocus
                  value={foodName}
                  onChange={e => setFoodName(e.target.value)}
                  placeholder="Назва (Гречка, Яйця...)"
                  className="w-full px-0 py-3 font-condensed text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <input
                  value={foodKcal}
                  onChange={e => setFoodKcal(e.target.value.replace(/\D/g, ''))}
                  placeholder="Калорії (ккал)"
                  inputMode="numeric"
                  className="w-full px-0 py-3 font-mono text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <button
                  onClick={handleAddFood}
                  disabled={saving || !foodName.trim() || !foodKcal}
                  className="w-full py-3 font-condensed font-semibold text-sm"
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  Додати
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
