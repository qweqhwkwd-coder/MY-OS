import { useEffect, useState } from 'react'
import { api } from '../api'
import type { TodayData } from '../api'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { ProgressBar } from '../components/ProgressBar'
import { useToast } from '../components/Toast'
import { xpToastText } from '../utils'

type Modal = 'water' | 'task' | 'note' | 'food' | null

const QUICK_BUTTONS: { id: Modal; icon: string; label: string }[] = [
  { id: 'water', icon: '💧', label: 'ВОДУ' },
  { id: 'task',  icon: '✅', label: 'ЗАДАЧУ' },
  { id: 'note',  icon: '📋', label: 'НОТАТКУ' },
  { id: 'food',  icon: '🍽', label: 'ЇЖУ' },
]

export function Today({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [data, setData] = useState<TodayData | null>(null)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [foodName, setFoodName] = useState('')
  const [foodGrams, setFoodGrams] = useState('')
  const [foodKcal, setFoodKcal] = useState('')
  const [lastWaterAdd, setLastWaterAdd] = useState<number | null>(null)

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
    setFoodGrams('')
    setFoodKcal('')
  }

  async function handleAddWater(amount: number) {
    setSaving(true)
    setSaveErr('')
    // Не закриваємо модалку — воду додають кількома натисканнями підряд, на відміну
    // від задачі/нотатки/їжі, де один запис = одна дія.
    try {
      const res = await api.addWater(initData, amount)
      if (res.xp_granted) push(xpToastText(res.xp_granted))
      setLastWaterAdd(amount)
      reload(); onDataChange?.()
    }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  async function handleUndoWater() {
    if (lastWaterAdd === null) return
    setSaving(true)
    setSaveErr('')
    try {
      await api.undoWater(initData, lastWaterAdd)
      setLastWaterAdd(null)
      reload(); onDataChange?.()
    }
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
    try {
      const entry = await api.addFoodEntry(initData, foodName.trim(), parseInt(foodKcal), foodGrams ? parseInt(foodGrams) : undefined)
      if (entry.xp_granted) push(xpToastText(entry.xp_granted))
      reload(); onDataChange?.(); closeModal()
    }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>
  if (!data) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>

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
          <ProgressBar value={data.water} max={data.water_goal} color="bg-[#3b82f6]" height="h-1" />
        </div>

        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>РИТУАЛИ</span>
            <div className="text-right">
              <span className="font-condensed font-bold text-xl">{data.rituals_done}/{data.rituals_total}</span>
              <span className="font-mono text-xs ml-1" style={{ color: 'var(--muted)' }}>{ritualPct}%</span>
            </div>
          </div>
          <ProgressBar value={data.rituals_done} max={data.rituals_total} color="bg-[#f97316]" height="h-1" />
        </div>

        <div className="px-4 py-4 flex items-baseline justify-between" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>ЗАВДАННЯ</span>
          <div className="text-right">
            <span className="font-condensed font-bold text-xl">{data.tasks_done}</span>
            <span className="font-mono text-xs ml-1" style={{ color: 'var(--muted)' }}>виконано</span>
          </div>
        </div>

        {/* Calories */}
        <div className="px-4 py-4 space-y-2" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="font-condensed text-sm">🍽 Калорії</span>
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
              {data.kcal}{data.kcal_goal ? ` / ${data.kcal_goal}` : ''} ккал
            </span>
          </div>
          {data.kcal_goal && (
            <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--subtle)' }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((data.kcal / data.kcal_goal) * 100))}%`,
                  background: data.kcal >= data.kcal_goal ? '#dc2626' : '#f97316',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick-add modal */}
      <BottomSheet open={modal !== null} onClose={closeModal}>
        <div className="p-6 space-y-4">
          {saveErr && (
            <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>
          )}

          {modal === 'water' && (
            <>
              <div className="font-condensed font-semibold text-base">💧 Додати воду</div>
              <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{data.water} / {data.water_goal} мл</div>
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
              {lastWaterAdd !== null && (
                <button
                  onClick={handleUndoWater}
                  disabled={saving}
                  className="w-full py-2 font-mono text-xs"
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  ↩ Відмінити останнє (+{lastWaterAdd} мл)
                </button>
              )}
            </>
          )}

          {modal === 'task' && (
            <>
              <div className="font-condensed font-semibold text-base">✅ Нова задача</div>
              <TextField
                autoFocus
                value={taskTitle}
                onChange={setTaskTitle}
                onEnter={handleAddTask}
                placeholder="Назва задачі..."
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
              <TextField
                autoFocus
                multiline
                value={noteText}
                onChange={setNoteText}
                placeholder="Запиши думку..."
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
              <TextField
                autoFocus
                border="subtle"
                value={foodName}
                onChange={setFoodName}
                placeholder="Назва (Гречка, Яйця...)"
              />
              <TextField
                border="subtle"
                font="mono"
                inputMode="numeric"
                value={foodGrams}
                onChange={v => setFoodGrams(v.replace(/\D/g, ''))}
                placeholder="Грами (за бажанням)"
              />
              <TextField
                border="subtle"
                font="mono"
                inputMode="numeric"
                value={foodKcal}
                onChange={v => setFoodKcal(v.replace(/\D/g, ''))}
                placeholder="Калорії (ккал)"
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
      </BottomSheet>
    </div>
  )
}
