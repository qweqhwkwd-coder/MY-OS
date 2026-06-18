import type { ProfileData } from '../api'

interface Props {
  profile: ProfileData | null
  onProfileClick: () => void
}

function hpColor(hp: number): string {
  if (hp > 60) return 'var(--hp-hi)'
  if (hp >= 30) return 'var(--hp-mid)'
  return 'var(--hp-lo)'
}

export function SysBar({ profile, onProfileClick }: Props) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{ background: '#1a1a1a', color: '#f8f7f4', minHeight: '40px' }}
    >
      {profile ? (
        <div className="flex items-center gap-3 font-mono text-xs">
          <span style={{ color: hpColor(profile.hp) }}>HP {profile.hp}</span>
          <span style={{ color: 'rgba(248,247,244,0.3)' }}>|</span>
          <span>LV {profile.level}</span>
          <span style={{ color: 'rgba(248,247,244,0.3)' }}>|</span>
          <span style={{ color: 'var(--accent-light)' }}>+{profile.xp_today} XP</span>
          <span style={{ color: 'rgba(248,247,244,0.3)' }}>|</span>
          <span>{profile.streak}🔥</span>
        </div>
      ) : (
        <div className="font-mono text-xs" style={{ color: 'rgba(248,247,244,0.3)' }}>
          MY-OS
        </div>
      )}
      <button
        onClick={onProfileClick}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px' }}
        aria-label="Профіль"
      >
        ⚔️
      </button>
    </div>
  )
}
