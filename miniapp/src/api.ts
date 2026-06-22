const BASE = import.meta.env.VITE_API_URL || 'https://my-os-ijgn.onrender.com'

async function req<T>(path: string, initData: string, options?: RequestInit): Promise<T> {
  // Render free tier sleeps after 15 min idle and can take 30-60s to wake up — the
  // first request during that window sometimes drops with a network-level failure
  // ("Load failed" / "Failed to fetch") rather than waiting. GET requests are safe
  // to retry (no side effects); POST/PATCH/DELETE get exactly one attempt so we
  // never risk double-submitting an action.
  const isGet = !options?.method
  const maxAttempts = isGet ? 3 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
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
        // Якщо сервер повернув HTML — VITE_API_URL вказує не туди (GitHub Pages замість Render)
        if (body.trimStart().startsWith('<')) {
          throw new Error(`Невірна адреса API (${res.status}). Перевір VITE_API_URL → має бути Render URL.`)
        }
        throw new Error(`${res.status}: ${body || path}`)
      }
      return res.json()
    } catch (e) {
      const isNetworkFailure = e instanceof TypeError
      if (!isNetworkFailure || attempt === maxAttempts) throw e
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  throw new Error('unreachable')
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
  addRitual: (initData: string, title: string) =>
    req<Ritual>('/api/rituals', initData, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
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
  diary: (initData: string) => req<DiaryEntry[]>('/api/diary', initData),
  addDiaryEntry: (initData: string, text: string, mood?: number) =>
    req<DiaryEntry>('/api/diary', initData, {
      method: 'POST',
      body: JSON.stringify({ text, mood }),
    }),
  renameRitual: (initData: string, id: string, title: string) =>
    req<{ ok: boolean }>(`/api/rituals/${id}`, initData, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteRitual: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/rituals/${id}`, initData, { method: 'DELETE' }),
  renameTask: (initData: string, id: string, title: string) =>
    req<{ ok: boolean }>(`/api/tasks/${id}`, initData, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteTask: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/tasks/${id}`, initData, { method: 'DELETE' }),
  inbox: (initData: string) => req<InboxItem[]>('/api/inbox', initData),
  inboxToTask: (initData: string, id: string) =>
    req<Task>(`/api/inbox/${id}/to-task`, initData, { method: 'POST' }),
  inboxToDiary: (initData: string, id: string) =>
    req<{ id: string }>(`/api/inbox/${id}/to-diary`, initData, { method: 'POST' }),
  inboxToIdea: (initData: string, id: string) =>
    req<{ id: string }>(`/api/inbox/${id}/to-idea`, initData, { method: 'POST' }),
  inboxToMeeting: (initData: string, id: string, date: string, time?: string) =>
    req<{ id: string }>(`/api/inbox/${id}/to-meeting`, initData, {
      method: 'POST',
      body: JSON.stringify({ date, time }),
    }),
  deleteInboxItem: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/inbox/${id}`, initData, { method: 'DELETE' }),
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

export interface InboxItem {
  id: string
  text: string
  created_at: string
}

export interface DiaryEntry {
  date: string
  text: string
  mood: number | null
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
