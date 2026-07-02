import { useEffect, useState } from 'react'
import { api } from '../api'
import type { TodayData, ProfileData } from '../api'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { MonoBar } from '../components/MonoBar'
import { useToast } from '../components/Toast'
import { xpToastText, kbjuFromKcal, haptic } from '../utils'
import { quoteOfToday } from '../quotes'

type Modal = 'water' | 'task' | 'note' | 'food' | null

const QUICK_BUTTONS: { id: Modal; label: string }[] = [
  { id: 'water', label: '+ ВОДА' },
  { id: 'task',  label: '+ ЗАДАЧА' },
  { id: 'note',  label: '+ НОТАТКА' },
  { id: 'food',  label: '+ ЇЖА' },
]

// Рахуємо в UTC від календарних компонентів — локальна арифметика дає
// зсув на день у годину після переходу на літній час (EEST)
function dayOfYear(d: Date): number {
  return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000
}

function daysInYear(y: number): number {
  return (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000
}

export function Today({ initData, onDataChange, profile }: { initData: string; onDataChange?: () => void; profile?: ProfileData | null }) {
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
      haptic('success')
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
      haptic('light')
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
    try { await api.addTask(initData, taskTitle.trim()); haptic('success'); reload(); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSaving(true)
    setSaveErr('')
    try { await api.addNote(initData, noteText.trim()); haptic('success'); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  async function handleAddFood() {
    if (!foodName.trim() || !foodKcal) return
    setSaving(true)
    setSaveErr('')
    try {
      const entry = await api.addFoodEntry(initData, foodName.trim(), parseInt(foodKcal), foodGrams ? parseInt(foodGrams) : undefined)
      haptic('success')
      if (entry.xp_granted) push(xpToastText(entry.xp_granted))
      reload(); onDataChange?.(); closeModal()
    }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }

  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>
  if (!data) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>

  const now = new Date()
  const weekday = now.toLocaleDateString('uk-UA', { weekday: 'short' }).toUpperCase()
  const dayMonth = now.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }).toUpperCase()
  const quote = quoteOfToday()
  const waterPct = data.water_goal > 0 ? Math.round((data.water / data.water_goal) * 100) : 0

  return (
    <div style={{ color: 'var(--ink)' }}>
      {/* Шапка дня */}
      <div className="px-4 pt-4 font-condensed font-bold" style={{ fontSize: '30px', lineHeight: 1.1, letterSpacing: '0.01em' }}>
        {weekday} · {dayMonth}
      </div>
      <div className="px-4 pb-3 pt-1 font-mono text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.04em', borderBottom: '1px solid var(--subtle)' }}>
        ДЕНЬ {dayOfYear(now)} / {daysInYear(now.getFullYear())}
        {profile ? ` · ${profile.streak}🔥 · +${profile.xp_today} XP СЬОГОДНІ` : ''}
      </div>

      {/* Цитата дня */}
      <div className="px-4 py-2.5 font-condensed text-sm italic" style={{ color: 'var(--muted)', lineHeight: 1.4, borderBottom: '1px solid var(--subtle)' }}>
        «{quote.text}» — {quote.author}
      </div>

      {/* Quick-add */}
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.05em', borderBottom: '1px solid var(--subtle)' }}>
        ШВИДКО ДОДАТИ
      </div>
      <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--subtle)' }}>
        {QUICK_BUTTONS.map((btn, idx) => (
          <button
            key={btn.id}
            onClick={() => { haptic('light'); setModal(btn.id) }}
            className="press-invert font-mono text-xs py-4"
            style={{
              minHeight: '48px',
              letterSpacing: '0.06em',
              background: 'transparent',
              border: 'none',
              borderRight: idx % 2 === 0 ? '1px solid var(--subtle)' : 'none',
              borderBottom: idx < 2 ? '1px solid var(--subtle)' : 'none',
              color: 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Digest rows */}
      <div>
        <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <span className="font-condensed" style={{ fontSize: '15px' }}>Вода</span>
          <MonoBar value={data.water} max={data.water_goal} label={`${waterPct}% · ${data.water} мл`} />
        </div>

        <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <span className="font-condensed" style={{ fontSize: '15px' }}>Ритуали</span>
          <MonoBar value={data.rituals_done} max={data.rituals_total} label={`${data.rituals_done}/${data.rituals_total}`} />
        </div>

        <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <span className="font-condensed" style={{ fontSize: '15px' }}>Завдання</span>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{data.tasks_done} виконано</span>
        </div>

        {/* Calories + КБЖУ norm */}
        <div className="px-4 py-3.5 space-y-2" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="font-condensed" style={{ fontSize: '15px' }}>Калорії</span>
            {data.kcal_goal ? (
              <MonoBar
                value={data.kcal}
                max={data.kcal_goal}
                label={`${data.kcal}/${data.kcal_goal}`}
                color={data.kcal >= data.kcal_goal ? 'var(--hp-lo)' : 'var(--ink)'}
              />
            ) : (
              <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{data.kcal} ккал</span>
            )}
          </div>
          {data.kcal_goal ? (() => {
            const m = kbjuFromKcal(data.kcal_goal)
            return (
              <div className="flex items-center justify-between font-mono text-xs" style={{ color: 'var(--muted)' }}>
                <span>НОРМА КБЖУ</span>
                <span>Б {m.protein}г · Ж {m.fat}г · В {m.carbs}г</span>
              </div>
            )
          })() : (
            <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
              Заповни профіль «Тіло» (⚔️ → 💪), щоб бачити норму КБЖУ
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
              <div className="font-condensed font-semibold text-base">Додати воду</div>
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
              <div className="font-condensed font-semibold text-base">Нова задача</div>
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
              <div className="font-condensed font-semibold text-base">Нова нотатка</div>
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
              <div className="font-condensed font-semibold text-base">Їжа</div>
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
