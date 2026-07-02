import { useState, useEffect, lazy, Suspense } from 'react'
import { api } from '../api'
import type { ProfileData, XpPoint } from '../api'
import { MonoBar } from './MonoBar'
import { hpColor, kbjuFromKcal, haptic } from '../utils'

const XpChart = lazy(() => import('./XpChart'))

export type Theme = 'light' | 'dark' | 'auto'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Світла' },
  { value: 'dark',  label: 'Темна' },
  { value: 'auto',  label: 'Авто — за системою' },
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
  const [bodyData, setBodyData] = useState<{ weight_kg: string; height_cm: string; age: string; activity_level: string; sex: string }>({
    weight_kg: '', height_cm: '', age: '', activity_level: 'moderate', sex: 'male',
  })
  const [bodyLoading, setBodyLoading] = useState(false)
  const [bodySaving, setBodySaving] = useState(false)
  const [bodyErr, setBodyErr] = useState('')
  const [bodyKcal, setBodyKcal] = useState<number | null>(profile.kcal_goal ?? null)
  const [xpHistory, setXpHistory] = useState<XpPoint[] | null>(null)
  const [xpHistoryErr, setXpHistoryErr] = useState(false)

  useEffect(() => {
    api.xpHistory(initData)
      .then(setXpHistory)
      .catch(() => setXpHistoryErr(true))
  }, [initData])

  useEffect(() => {
    if (view !== 'body') return
    setBodyLoading(true)
    api.getBodyProfile(initData).then(d => {
      setBodyData({
        weight_kg: d.weight_kg != null ? String(d.weight_kg) : '',
        height_cm: d.height_cm != null ? String(d.height_cm) : '',
        age: d.age != null ? String(d.age) : '',
        activity_level: d.activity_level ?? 'moderate',
        sex: d.sex ?? 'male',
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
            onClick={() => { haptic('light'); setView('profile') }}
            className="font-mono text-xs"
            style={{ color: 'rgba(248,247,244,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', minHeight: '44px', letterSpacing: '0.06em' }}
          >
            ← ПРОФІЛЬ
          </button>
        ) : (
          <span className="font-condensed font-semibold text-base">Профіль</span>
        )}
        <div className="flex items-center gap-2">
          {view === 'profile' && (
            <>
              <button
                onClick={() => { haptic('light'); setView('body') }}
                className="font-mono text-xs"
                style={{ color: 'rgba(248,247,244,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', minHeight: '44px', letterSpacing: '0.06em' }}
              >
                ТІЛО
              </button>
              <button
                onClick={() => { haptic('light'); setView('settings') }}
                className="font-mono text-xs"
                style={{ color: 'rgba(248,247,244,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', minHeight: '44px', letterSpacing: '0.06em' }}
              >
                ТЕМА
              </button>
            </>
          )}
          <button
            onClick={() => { haptic('light'); onClose() }}
            className="font-mono text-sm"
            style={{ color: 'rgba(248,247,244,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', minHeight: '44px', minWidth: '44px' }}
            aria-label="Закрити"
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
              <div className="space-y-1">
                <div className="font-condensed text-xs" style={{ color: 'var(--muted)' }}>Стать</div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { value: 'male', label: 'Чоловіча' },
                    { value: 'female', label: 'Жіноча' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { haptic('light'); setBodyData(prev => ({ ...prev, sex: opt.value })) }}
                      aria-pressed={bodyData.sex === opt.value}
                      className="py-3 font-condensed text-sm"
                      style={{
                        background: bodyData.sex === opt.value ? 'var(--ink)' : 'var(--subtle)',
                        color: bodyData.sex === opt.value ? 'var(--bg)' : 'var(--ink)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
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
                    onClick={() => { haptic('light'); setBodyData(prev => ({ ...prev, activity_level: opt.value })) }}
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

              {bodyKcal !== null && (() => {
                const m = kbjuFromKcal(bodyKcal)
                return (
                  <div className="px-3 py-3" style={{ background: 'var(--subtle)' }}>
                    <div className="font-condensed font-semibold text-sm">КБЖУ · TDEE: {bodyKcal} ккал/день</div>
                    <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      Б: {m.protein}г · Ж: {m.fat}г · В: {m.carbs}г
                    </div>
                  </div>
                )
              })()}

              {bodyErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{bodyErr}</div>}
              <button
                onClick={async () => {
                  setBodyErr('')
                  setBodySaving(true)
                  try {
                    const res = await api.updateBodyProfile(initData, {
                      weight_kg: bodyData.weight_kg ? parseFloat(bodyData.weight_kg) : undefined,
                      height_cm: bodyData.height_cm ? parseInt(bodyData.height_cm, 10) : undefined,
                      age: bodyData.age ? parseInt(bodyData.age, 10) : undefined,
                      activity_level: bodyData.activity_level || undefined,
                      sex: bodyData.sex || undefined,
                    })
                    haptic('success')
                    if (res.kcal_goal != null) setBodyKcal(res.kcal_goal)
                  } catch (e: unknown) {
                    setBodyErr(e instanceof Error ? e.message : 'Помилка збереження')
                  } finally {
                    setBodySaving(false)
                  }
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
              onClick={() => { if (theme !== opt.value) { haptic('light'); onThemeChange(opt.value) } }}
              className="w-full flex items-center justify-between px-4 py-4 text-left"
              style={{
                background: theme === opt.value ? 'var(--subtle)' : 'transparent',
                border: 'none',
                // на підсвіченому рядку var(--subtle) зливається з таким самим фоном
                borderBottom: theme === opt.value ? '1px solid var(--muted)' : '1px solid var(--subtle)',
                cursor: 'pointer',
                color: 'var(--ink)',
                minHeight: '48px',
              }}
            >
              <span className="font-condensed" style={{ fontSize: '15px' }}>{opt.label}</span>
              {theme === opt.value && (
                <span className="font-mono text-xs">✓</span>
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
              className="w-12 h-12 flex items-center justify-center font-condensed font-bold text-xl"
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
              <MonoBar value={rankProgress} max={100} color="var(--accent)" />
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
          <MonoBar value={profile.hp} max={100} color={hpColor(profile.hp)} />
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
          <MonoBar value={xpInLevel} max={100} color="var(--accent)" />
        </div>

        {/* XP growth — 30 days */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
          <div className="font-mono text-xs mb-3" style={{ color: 'var(--muted)' }}>РІСТ — XP ЗА 30 ДНІВ</div>
          {xpHistoryErr && (
            <div className="font-condensed text-sm py-4" style={{ color: 'var(--muted)' }}>
              Не вдалося завантажити графік. Спробуй перевідкрити профіль.
            </div>
          )}
          {!xpHistoryErr && !xpHistory && (
            <div className="font-mono text-xs py-4" style={{ color: 'var(--muted)' }}>…</div>
          )}
          {xpHistory && (
            <Suspense fallback={<div className="font-mono text-xs py-4" style={{ color: 'var(--muted)' }}>…</div>}>
              <XpChart data={xpHistory} />
            </Suspense>
          )}
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
                <MonoBar value={progress} max={100} />
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
