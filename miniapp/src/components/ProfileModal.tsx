import type { ProfileData } from '../api'
import { ProgressBar } from './ProgressBar'

const STATS_META = [
  { key: 'strength',   label: 'Сила' },
  { key: 'endurance',  label: 'Витривалість' },
  { key: 'nutrition',  label: 'Харчування' },
  { key: 'discipline', label: 'Дисципліна' },
  { key: 'reflection', label: 'Рефлексія' },
  { key: 'health',     label: "Здоров'я" },
  { key: 'finance',    label: 'Фінанси' },
  { key: 'intellect',  label: 'Інтелект' },
]

function hpColor(hp: number): string {
  if (hp > 60) return 'var(--hp-hi)'
  if (hp >= 30) return 'var(--hp-mid)'
  return 'var(--hp-lo)'
}

interface Props {
  profile: ProfileData
  onClose: () => void
}

export function ProfileModal({ profile, onClose }: Props) {
  const xpInLevel = profile.xp_total % 100
  const xpToNext = 100 - xpInLevel

  const avgXp = profile.xp_total / 8
  const rankProgress = profile.next_rank_xp_min != null
    ? Math.min(100, Math.max(0, Math.round(
        (avgXp - profile.rank_xp_min) /
        (profile.next_rank_xp_min - profile.rank_xp_min) * 100
      )))
    : 100

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: '#1a1a1a', color: '#f8f7f4', borderBottom: '1px solid rgba(248,247,244,0.1)' }}
      >
        <span className="font-condensed font-semibold text-base">Профіль</span>
        <button
          onClick={onClose}
          className="font-mono text-sm"
          style={{ color: 'rgba(248,247,244,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-condensed font-bold text-xl"
              style={{ background: '#1a1a1a', color: '#f8f7f4' }}
            >
              {(profile.name || 'H').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-condensed font-semibold text-base">{profile.name || 'Герой'}</div>
              <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>LV {profile.level}</div>
            </div>
          </div>
        </div>

        {/* Rank + percentile */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="font-condensed font-bold text-xl">{profile.rank}</div>
              {profile.next_rank && (
                <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  → {profile.next_rank} ({Math.max(0, Math.round((profile.next_rank_xp_min ?? 0) - avgXp))} XP)
                </div>
              )}
              <ProgressBar value={rankProgress} max={100} color="bg-indigo-600" />
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-condensed font-bold text-4xl leading-none" style={{ color: 'var(--accent)' }}>
                {profile.percentile}%
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)', maxWidth: '90px' }}>
                ти кращий за {profile.percentile}% людей
              </div>
            </div>
          </div>
        </div>

        {/* HP */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-condensed font-medium text-sm">HP — Здоров'я</span>
            <span className="font-mono text-sm font-medium" style={{ color: hpColor(profile.hp) }}>
              {profile.hp}/100
            </span>
          </div>
          <div className="w-full h-3 rounded-full" style={{ background: 'var(--subtle)' }}>
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{ width: `${profile.hp}%`, background: hpColor(profile.hp) }}
            />
          </div>
          <div className="font-mono text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Вода 30% · Ритуали 40% · Сон 20% · Їжа 10% (3 дні)
          </div>
        </div>

        {/* XP level progress */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-condensed font-medium text-sm">XP — Рівень {profile.level}</span>
            <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>
              ще {xpToNext} XP → LV {profile.level + 1}
            </span>
          </div>
          <ProgressBar value={xpInLevel} max={100} color="bg-indigo-600" height="h-2" />
        </div>

        {/* 8 stats */}
        <div className="px-4 py-4 space-y-4">
          <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>ХАРАКТЕРИСТИКИ</div>
          {STATS_META.map(({ key, label }) => {
            const xp = profile.stats[key] ?? 0
            const lvl = Math.floor(xp / 100)
            const progress = xp % 100
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-condensed text-sm">{label}</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                    lv{lvl} · {xp} xp
                  </span>
                </div>
                <ProgressBar value={progress} max={100} color="bg-indigo-600" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
