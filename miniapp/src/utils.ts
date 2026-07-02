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

export function xpToastText(xp: { stat: string; amount: number }): string {
  return `+${xp.amount} XP до ${STAT_LABEL[xp.stat] ?? xp.stat}`
}

export function hpColor(hp: number): string {
  if (hp > 60) return 'var(--hp-hi)'
  if (hp >= 30) return 'var(--hp-mid)'
  return 'var(--hp-lo)'
}
