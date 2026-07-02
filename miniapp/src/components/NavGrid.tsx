import { haptic } from '../utils'

export interface Module {
  id: string
  num: string
  label: string
  locked: boolean
  /** акцент модуля — 2px лінійка зліва на сторінці; чорнила для нейтральних */
  color: string
}

export const MODULES: Module[] = [
  { id: 'today',   num: '01', label: 'Сьогодні', locked: false, color: 'var(--ink)' },
  { id: 'water',   num: '02', label: 'Вода',      locked: false, color: 'var(--mod-water)' },
  { id: 'rituals', num: '03', label: 'Ритуали',   locked: false, color: 'var(--mod-rituals)' },
  { id: 'tasks',   num: '04', label: 'Завдання',  locked: false, color: 'var(--ink)' },
  { id: 'food',    num: '05', label: 'Їжа',       locked: false, color: 'var(--mod-food)' },
  { id: 'sleep',   num: '06', label: 'Сон',       locked: false, color: 'var(--mod-sleep)' },
  { id: 'finance', num: '07', label: 'Фінанси',   locked: false, color: 'var(--mod-finance)' },
  { id: 'goals',   num: '08', label: 'Цілі',      locked: false, color: 'var(--ink)' },
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: false, color: 'var(--ink)' },
  { id: 'ideas',   num: '10', label: 'Ідеї',      locked: false, color: 'var(--ink)' },
  { id: 'meet',    num: '11', label: 'Зустрічі',  locked: false, color: 'var(--ink)' },
  { id: 'digest',  num: '12', label: 'Дайджест',  locked: false, color: 'var(--ink)' },
  { id: 'notes',   num: '13', label: 'Нотатки',   locked: false, color: 'var(--ink)' },
  { id: 'workouts', num: '14', label: 'Тренування', locked: false, color: 'var(--mod-workouts)' },
]

export const OPEN_MODULES = MODULES.filter(m => !m.locked)
const LOCKED_LABELS = MODULES.filter(m => m.locked).map(m => m.label)

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

// Сітка лише відкритих модулів (закриті — одним рядком «Скоро» нижче),
// хвіст останнього ряду добивається порожніми клітинками
export function NavGrid({ activeView, onNavigate }: Props) {
  const trailing = (3 - (OPEN_MODULES.length % 3)) % 3

  return (
    <div>
      <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
        {OPEN_MODULES.map((mod, idx) => {
          const isActive = mod.id === activeView
          const isLastCol = (idx + 1) % 3 === 0

          return (
            <button
              key={mod.id}
              onClick={() => { haptic('light'); onNavigate(mod.id) }}
              className="press-invert relative flex flex-col items-start justify-between p-3 text-left"
              style={{
                border: 'none',
                borderRight: isLastCol ? 'none' : '1px solid var(--subtle)',
                borderBottom: '1px solid var(--subtle)',
                background: isActive ? 'var(--ink)' : 'transparent',
                color: isActive ? 'var(--bg)' : 'var(--ink)',
                cursor: 'pointer',
                minHeight: '72px',
                outline: 'none',
              }}
            >
              <span
                className="font-mono text-xs leading-none"
                style={{ color: isActive ? 'var(--bg)' : 'var(--muted)', opacity: isActive ? 0.45 : 1 }}
              >
                {mod.num}
              </span>
              <span className="font-condensed text-sm font-medium leading-tight mt-1">
                {mod.label}
              </span>
            </button>
          )
        })}
        {Array.from({ length: trailing }).map((_, i) => (
          <div
            key={`empty-${i}`}
            style={{
              borderRight: i === trailing - 1 ? 'none' : '1px solid var(--subtle)',
              borderBottom: '1px solid var(--subtle)',
              minHeight: '72px',
            }}
          />
        ))}
      </div>
      {LOCKED_LABELS.length > 0 && (
        <div
          className="font-mono px-4 py-2"
          style={{ fontSize: '10px', letterSpacing: '0.05em', color: 'var(--locked-text)', borderBottom: '1px solid var(--subtle)' }}
        >
          СКОРО: {LOCKED_LABELS.map(l => l.toUpperCase()).join(' · ')}
        </div>
      )}
    </div>
  )
}
