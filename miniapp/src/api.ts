const BASE = import.meta.env.VITE_API_URL || 'https://my-os-ijgn.onrender.com'

async function req<T>(path: string, initData: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body || path}`)
  }
  return res.json()
}

export const api = {
  today: (initData: string) => req<TodayData>('/api/today', initData),
  stats: (initData: string) => req<StatsData>('/api/stats', initData),
  water: (initData: string) => req<{ total: number; goal: number }>('/api/water', initData),
  addWater: (initData: string, amount: number) =>
    req<{ total: number }>('/api/water', initData, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  food: (initData: string) => req<FoodEntry[]>('/api/food', initData),
  rituals: (initData: string) => req<Ritual[]>('/api/rituals', initData),
  toggleRitual: (initData: string, id: string) =>
    req<{ done: boolean }>(`/api/rituals/${id}/toggle`, initData, { method: 'POST' }),
  tasks: (initData: string) => req<Task[]>('/api/tasks', initData),
  completeTask: (initData: string, id: string) =>
    req<{ done: boolean }>(`/api/tasks/${id}/complete`, initData, { method: 'POST' }),
  digest: (initData: string) => req<DigestData>('/api/digest', initData),
  profile: (initData: string) => req<ProfileData>('/api/profile', initData),
  addTask: (initData: string, title: string) =>
    req<Task>('/api/tasks', initData, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  addNote: (initData: string, text: string) =>
    req<{ id: string }>('/api/inbox', initData, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  addFoodEntry: (initData: string, food_name: string, kcal: number, grams?: number) =>
    req<FoodEntry>('/api/food', initData, {
      method: 'POST',
      body: JSON.stringify({ food_name, kcal, grams }),
    }),
}

export interface TodayData {
  level: number
  water: number
  water_goal: number
  rituals_done: number
  rituals_total: number
  tasks_done: number
  kcal: number
}

export interface StatsData {
  level: number
  strength: number
  endurance: number
  nutrition: number
  discipline: number
  reflection: number
  health: number
  finance: number
  intellect: number
}

export interface FoodEntry {
  id: string
  food_name: string
  kcal: number
  grams: number | null
  created_at: string
}

export interface Ritual {
  id: string
  title: string
  icon: string | null
  done: boolean
  streak: number
}

export interface Task {
  id: string
  title: string
  is_completed: boolean
}

export interface DigestData {
  water_total: number
  water_days: number
  rituals_done: number
  tasks_done: number
  kcal_avg: number
  sleep_avg_h: number
  workouts: number
  spend_total: number
  xp_earned: number
}

export interface ProfileData {
  name: string
  level: number
  xp_total: number
  xp_today: number
  streak: number
  hp: number
  rank: string
  percentile: number
  rank_xp_min: number
  next_rank: string | null
  next_rank_xp_min: number | null
  stats: Record<string, number>
}
