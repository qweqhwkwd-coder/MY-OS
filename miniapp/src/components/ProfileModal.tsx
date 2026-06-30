import { useState, useEffect } from 'react'
import { api } from '../api'
import type { ProfileData } from '../api'
import { ProgressBar } from './ProgressBar'
import { hpColor } from '../utils'

export type Theme = 'light' | 'dark' | 'auto'

const THEME_OPTIONS: { value: Theme; icon: string; label: string }[] = [
  { value: 'light', icon: '☀️', label: 'Світла' },
  { value: 'dark',  icon: '🌙', label: 'Темна' },
  { value: 'auto',  icon: '◐',  label: 'Авто' },
]

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

interface Props {
  profile: ProfileData
  onClose: () => void
  theme: Theme
  onThemeChange: (t: Theme) => void
  initData: string
}

export function ProfileModal({ profile, onClose, theme, onThemeChange, initData }: Props) {
  const [view, setView] = useState<'profile' | 'settings' | 'body'>('profile')
  const [bodyData, setBodyData] = useState<{ weight_kg: string; height_cm: string; age: string; activity_level: string }>({
    weight_kg: '', height_cm: '', age: '', activity_level: 'moderate',
  })
  const [bodyLoading, setBodyLoading] = useState(false)
  const [bodySaving, setBodySaving] = useState(false)
  const [bodyKcal, setBodyKcal] = useState<number | null>(profile.kcal_goal ?? null)

  useEffect(() => {
    if (view !== 'body') return
    setBodyLoading(true)
    api.getBodyProfile(initData).then(d => {
      setBodyData({
        weight_kg: d.weight_kg != null ? String(d.weight_kg) : '',
        height_cm: d.height_cm != null ? String(d.height_cm) : '',
        age: d.age != null ? String(d.age) : '',
        activity_level: d.activity_level ?? 'moderate',
      })
    }).catch(() => {}).finally(() => setBodyLoading(false))
  }, [view, initData])
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
        {(view === 'settings' || view === 'body') ? (
          <button
            onClick={() => setView('profile')}
            className="font-mono text-xs"
            style={{ color: 'rgba(248,247,244,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            ← Профіль
          </button>
        ) : (
          <span className="font-condensed font-semibold text-base">Профіль</span>
        )}
        <div className="flex items-center gap-2">
          {view === 'profile' && (
            <>
              <button
                onClick={() => setView('body')}
                className="font-mono text-sm"
                style={{ color: 'rgba(248,247,244,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                aria-label="Тіло"
              >
                💪
              </button>
              <button
                onClick={() => setView('settings')}
                className="font-mono text-sm"
                style={{ color: 'rgba(248,247,244,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
                aria-label="Налаштування"
              >
                ⚙️
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="font-mono text-sm"
            style={{ color: 'rgba(248,247,244,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>
      </div>

      {view === 'body' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
            ФІЗИЧНИЙ ПРОФІЛЬ
          </div>

          {bodyLoading ? (
            <div className="px-4 py-8 text-center font-mono text-sm" style={{ color: 'var(--muted)' }}>…</div>
          ) : (
            <div className="px-4 py-4 space-y-4">
              {[
                { key: 'weight_kg', label: 'Вага (кг)', placeholder: '75', inputMode: 'decimal' },
                { key: 'height_cm', label: 'Зріст (см)', placeholder: '180', inputMode: 'numeric' },
                { key: 'age', label: 'Вік (роки)', placeholder: '25', inputMode: 'numeric' },
              ].map(field => (
                <div key={field.key} className="space-y-1">
                  <div className="font-condensed text-xs" style={{ color: 'var(--muted)' }}>{field.label}</div>
                  <input
                    type="text"
                    inputMode={field.inputMode as 'decimal' | 'numeric'}
                    value={bodyData[field.key as keyof typeof bodyData]}
                    onChange={e => setBodyData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full font-mono text-sm px-3 py-3 outline-none"
                    style={{ background: 'var(--subtle)', border: 'none', color: 'var(--ink)' }}
                  />
                </div>
              ))}

              <div className="space-y-1">
                <div className="font-condensed text-xs" style={{ color: 'var(--muted)' }}>Рівень активності</div>
                {[
                  { value: 'low', label: 'Низький — офіс, без спорту' },
                  { value: 'moderate', label: 'Помірний — спорт 1-3 дні/тиж' },
                  { value: 'active', label: 'Активний — спорт 3-5 днів/тиж' },
                  { value: 'very_active', label: 'Дуже активний — щодня або важка праця' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setBodyData(prev => ({ ...prev, activity_level: opt.value }))}
                    className="w-full flex items-center justify-between px-3 py-3 text-left"
                    style={{
                      background: bodyData.activity_level === opt.value ? 'var(--ink)' : 'var(--subtle)',
                      color: bodyData.activity_level === opt.value ? 'var(--bg)' : 'var(--ink)',
                      border: 'none',
                      cursor: 'pointer',
                      marginBottom: '2px',
                    }}
                  >
                    <span className="font-condensed text-sm">{opt.label}</span>
                    {bodyData.activity_level === opt.value && (
                      <span className="font-mono text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {bodyKcal !== null && (
                <div className="px-3 py-3" style={{ background: 'var(--subtle)' }}>
                  <div className="font-condensed font-semibold text-sm">КБЖУ · TDEE: {bodyKcal} ккал/день</div>
                  <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    Б: {Math.round(bodyKcal * 0.30 / 4)}г · Ж: {Math.round(bodyKcal * 0.30 / 9)}г · В: {Math.round(bodyKcal * 0.40 / 4)}г
                  </div>
                </div>
              )}

              <button
                onClick={async () => {
                  setBodySaving(true)
                  try {
                    const res = await api.updateBodyProfile(initData, {
                      weight_kg: bodyData.weight_kg ? parseFloat(bodyData.weight_kg) : undefined,
                      height_cm: bodyData.height_cm ? parseInt(bodyData.height_cm, 10) : undefined,
                      age: bodyData.age ? parseInt(bodyData.age, 10) : undefined,
                      activity_level: bodyData.activity_level || undefined,
                    })
                    if (res.kcal_goal != null) setBodyKcal(res.kcal_goal)
                  } catch { /* silent */ }
                  finally { setBodySaving(false) }
                }}
                disabled={bodySaving}
                className="w-full py-3 font-condensed font-semibold text-sm"
                style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: bodySaving ? 0.5 : 1 }}
              >
                {bodySaving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'settings' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
            ТЕМА ОФОРМЛЕННЯ
          </div>
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onThemeChange(opt.value)}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--subtle)',
                cursor: 'pointer',
                color: 'var(--ink)',
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '18px', lineHeight: 1, width: '24px', textAlign: 'center' }}>{opt.icon}</span>
                <span className="font-condensed text-sm">{opt.label}</span>
              </div>
              {theme === opt.value && (
                <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {view === 'profile' && <div className="flex-1 overflow-y-auto">
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
      </div>}
    </div>
  )
}
