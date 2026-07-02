interface Module {
  id: string
  num: string
  label: string
  locked: boolean
}

const MODULES: Module[] = [
  { id: 'today',   num: '01', label: 'Сьогодні', locked: false },
  { id: 'water',   num: '02', label: 'Вода',      locked: false },
  { id: 'rituals', num: '03', label: 'Ритуали',   locked: false },
  { id: 'tasks',   num: '04', label: 'Завдання',  locked: false },
  { id: 'food',    num: '05', label: 'Їжа',       locked: false },
  { id: 'sleep',   num: '06', label: 'Сон',       locked: false },
  { id: 'finance', num: '07', label: 'Фінанси',   locked: false },
  { id: 'goals',   num: '08', label: 'Цілі',      locked: true  },
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: false },
  { id: 'ideas',   num: '10', label: 'Ідеї',      locked: true  },
  { id: 'meet',    num: '11', label: 'Зустрічі',  locked: true  },
  { id: 'digest',  num: '12', label: 'Дайджест',  locked: true  },
  { id: 'notes',   num: '13', label: 'Нотатки',   locked: false },
  { id: 'workouts', num: '14', label: 'Тренування', locked: false },
]

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

export function NavGrid({ activeView, onNavigate }: Props) {
  return (
    <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
      {MODULES.map((mod, idx) => {
        const isActive = mod.id === activeView
        const isLocked = mod.locked
        const isLastCol = (idx + 1) % 3 === 0

        return (
          <button
            key={mod.id}
            onClick={() => !isLocked && onNavigate(mod.id)}
            disabled={isLocked}
            className="relative flex flex-col items-start justify-between p-3 text-left"
            style={{
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: isLastCol ? 'none' : '1px solid var(--subtle)',
              borderBottom: '1px solid var(--subtle)',
              background: isActive ? 'var(--ink)' : isLocked ? 'var(--locked-bg)' : 'transparent',
              color: isActive ? 'var(--bg)' : isLocked ? 'var(--locked-text)' : 'var(--ink)',
              cursor: isLocked ? 'default' : 'pointer',
              minHeight: '72px',
              outline: 'none',
            }}
          >
            <span
              className="font-mono text-xs leading-none"
              style={{ color: isActive ? 'var(--bg)' : isLocked ? 'var(--locked-text)' : 'var(--muted)', opacity: isActive ? 0.45 : 1 }}
            >
              {mod.num}
            </span>
            <span className="font-condensed text-sm font-medium leading-tight mt-1">
              {mod.label}
            </span>
            {isLocked && (
              <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px' }}>🔒</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
