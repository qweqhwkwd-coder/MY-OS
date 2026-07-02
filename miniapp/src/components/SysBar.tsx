import type { ProfileData } from '../api'
import { hpColor, haptic } from '../utils'

interface Props {
  profile: ProfileData | null
  onProfileClick: () => void
}

const STATS = (profile: NonNullable<Props['profile']>) => [
  { value: String(profile.hp),            label: 'HP',    color: hpColor(profile.hp) },
  { value: `LV ${profile.level}`,         label: 'РІВЕНЬ', color: '#f8f7f4' },
  { value: `+${profile.xp_today}`,        label: 'XP',    color: 'var(--accent-light)' },
  { value: `${profile.streak}🔥`,         label: 'СТРІК', color: '#f8f7f4' },
]

export function SysBar({ profile, onProfileClick }: Props) {
  return (
    <div
      className="sysbar flex items-stretch"
      style={{ background: '#1a1a1a', color: '#f8f7f4', minHeight: '48px' }}
    >
      {profile ? (
        STATS(profile).map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center"
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRight: '1px solid rgba(248,247,244,0.1)',
            }}
          >
            <span className="font-mono text-sm font-medium leading-none" style={{ color: s.color }}>{s.value}</span>
            <span className="font-mono leading-none mt-1" style={{ fontSize: '9px', color: 'rgba(248,247,244,0.3)', letterSpacing: '0.06em' }}>{s.label}</span>
          </div>
        ))
      ) : (
        <div
          className="flex items-center justify-center font-mono text-xs flex-1"
          style={{ color: 'rgba(248,247,244,0.3)', borderRight: '1px solid rgba(248,247,244,0.1)' }}
        >
          MY-OS
        </div>
      )}
      <button
        onClick={() => { haptic('light'); onProfileClick() }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 14px', minWidth: '44px', color: 'rgba(248,247,244,0.85)' }}
        aria-label="Профіль"
      >
        ◎
      </button>
    </div>
  )
}
