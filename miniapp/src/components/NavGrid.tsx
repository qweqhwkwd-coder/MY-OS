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
  { id: 'sleep',   num: '06', label: 'Сон',       locked: true  },
  { id: 'finance', num: '07', label: 'Фінанси',   locked: true  },
  { id: 'goals',   num: '08', label: 'Цілі',      locked: true  },
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: true  },
  { id: 'ideas',   num: '10', label: 'Ідеї',      locked: true  },
  { id: 'meet',    num: '11', label: 'Зустрічі',  locked: true  },
  { id: 'digest',  num: '12', label: 'Дайджест',  locked: true  },
]

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

export function NavGrid({ activeView, onNavigate }: Props) {
  return (
    <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--subtle)' }}>
      {MODULES.map(mod => {
        const isActive = mod.id === activeView
        const isLocked = mod.locked

        return (
          <button
            key={mod.id}
            onClick={() => !isLocked && onNavigate(mod.id)}
            disabled={isLocked}
            className="relative flex flex-col items-start justify-between p-3 text-left"
            style={{
              borderRight: '1px solid var(--subtle)',
              borderBottom: '1px solid var(--subtle)',
              background: isActive ? '#1a1a1a' : isLocked ? '#f2f0ec' : 'transparent',
              color: isActive ? '#f8f7f4' : isLocked ? '#bbb' : 'var(--ink)',
              cursor: isLocked ? 'default' : 'pointer',
              minHeight: '72px',
              border: 'none',
              outline: 'none',
            }}
          >
            <span
              className="font-mono text-xs leading-none"
              style={{ color: isActive ? 'rgba(248,247,244,0.4)' : isLocked ? '#ccc' : 'var(--muted)' }}
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
