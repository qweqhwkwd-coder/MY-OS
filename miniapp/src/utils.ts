// Дублікат STAT_LABELS з бота (main.py) — усталений патерн дублювання констант бот/Mini App
export const STAT_LABEL: Record<string, string> = {
  strength: 'Сили',
  endurance: 'Витривалості',
  nutrition: 'Харчування',
  discipline: 'Дисципліни',
  reflection: 'Рефлексії',
  health: "Здоров'я",
  finance: 'Фінансів',
  intellect: 'Інтелекту',
}

// Запис у журналі «Паперової ОС»: +5 XP → ДИСЦИПЛІНА
export function xpToastText(xp: { stat: string; amount: number }): string {
  return `+${xp.amount} XP → ${(STAT_NAME[xp.stat] ?? xp.stat).toUpperCase()}`
}

// Називний відмінок — для майлстоун-тостів («Сила lvl 5!»)
export const STAT_NAME: Record<string, string> = {
  strength: 'Сила',
  endurance: 'Витривалість',
  nutrition: 'Харчування',
  discipline: 'Дисципліна',
  reflection: 'Рефлексія',
  health: "Здоров'я",
  finance: 'Фінанси',
  intellect: 'Інтелект',
}

// Локальна дата YYYY-MM-DD (не UTC! toISOString вночі віддає вчорашній день)
export function localIsoDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface Milestone {
  text: string
  size: 'sm' | 'lg'
}

interface ProfileSnapshot {
  level: number
  rank: string
  streak: number
  totals?: { tasks_done: number; rituals_done: number }
  stats: Record<string, number>
}

const STREAK_THRESHOLDS = [7, 30, 100]
const TOTAL_THRESHOLDS = [10, 50, 100]

// prev < threshold <= next — щоб не пропустити поріг при батчі з кількох
// нарахувань за один фетч профілю
function crossed(prev: number, next: number, thresholds: number[]): number | null {
  let hit: number | null = null
  for (const t of thresholds) {
    if (prev < t && t <= next) hit = t
  }
  return hit
}

export function profileMilestones(prev: ProfileSnapshot, next: ProfileSnapshot): Milestone[] {
  const out: Milestone[] = []

  if (next.level > prev.level) out.push({ text: `🎉 Рівень ${next.level}!`, size: 'lg' })
  if (next.rank !== prev.rank) out.push({ text: `🏆 Новий ранг: ${next.rank}!`, size: 'lg' })

  const streakHit = crossed(prev.streak, next.streak, STREAK_THRESHOLDS)
  if (streakHit) out.push({ text: `🔥 Стрік ${streakHit} днів!`, size: 'lg' })

  for (const key of Object.keys(next.stats)) {
    const prevLvl = Math.floor((prev.stats[key] ?? 0) / 100)
    const nextLvl = Math.floor((next.stats[key] ?? 0) / 100)
    const multiplesOf5 = []
    for (let m = 5; m <= nextLvl; m += 5) multiplesOf5.push(m)
    const hit = crossed(prevLvl, nextLvl, multiplesOf5)
    if (hit) out.push({ text: `${STAT_NAME[key] ?? key} lvl ${hit}!`, size: 'sm' })
  }

  if (prev.totals && next.totals) {
    const tasksHit = crossed(prev.totals.tasks_done, next.totals.tasks_done, TOTAL_THRESHOLDS)
    if (tasksHit) out.push({ text: `✅ ${tasksHit} задач виконано!`, size: 'lg' })
    const ritualsHit = crossed(prev.totals.rituals_done, next.totals.rituals_done, TOTAL_THRESHOLDS)
    if (ritualsHit) out.push({ text: `🔥 ${ritualsHit} ритуалів виконано!`, size: 'lg' })
  }

  return out
}

// Розкладка TDEE на макроси: 30% білки / 30% жири / 40% вуглеводи
// (та сама формула, що у вкладці «Тіло» профілю)
export function kbjuFromKcal(kcal: number): { protein: number; fat: number; carbs: number } {
  return {
    protein: Math.round(kcal * 0.30 / 4),
    fat: Math.round(kcal * 0.30 / 9),
    carbs: Math.round(kcal * 0.40 / 4),
  }
}

// Тактильний відгук Telegram WebApp — безпечно ігнорується поза Telegram
export function haptic(type: 'light' | 'medium' | 'success' = 'light') {
  try {
    const h = window.Telegram?.WebApp?.HapticFeedback
    if (!h) return
    if (type === 'success') h.notificationOccurred('success')
    else h.impactOccurred(type)
  } catch { /* старі клієнти без HapticFeedback */ }
}

export function hpColor(hp: number): string {
  if (hp > 60) return 'var(--hp-hi)'
  if (hp >= 30) return 'var(--hp-mid)'
  return 'var(--hp-lo)'
}
