const BASE = import.meta.env.VITE_API_URL || 'https://my-os-ijgn.onrender.com'

async function req<T>(path: string, initData: string, options?: RequestInit, retryable = false): Promise<T> {
  // Render free tier sleeps after 15 min idle and can take 30-60s to wake up — the
  // first request during that window sometimes drops with a network-level failure
  // ("Load failed" / "Failed to fetch") rather than waiting. GET requests are safe
  // to retry (no side effects); idempotent PATCH requests can also retry safely.
  // POST/DELETE get exactly one attempt so we never risk double-submitting an action.
  const isGet = !options?.method
  const maxAttempts = (isGet || retryable) ? 3 : 1

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
    req<{ total: number; xp_granted: XpGranted }>('/api/water', initData, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  undoWater: (initData: string, amount: number) =>
    req<{ total: number }>('/api/water/undo', initData, {
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
    req<{ done: boolean; xp_granted: XpGranted }>(`/api/rituals/${id}/toggle`, initData, { method: 'POST' }),
  tasks: (initData: string) => req<Task[]>('/api/tasks', initData),
  completeTask: (initData: string, id: string) =>
    req<{ done: boolean; xp_granted: XpGranted }>(`/api/tasks/${id}/complete`, initData, { method: 'POST' }),
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
    req<FoodEntry & { xp_granted: XpGranted }>('/api/food', initData, {
      method: 'POST',
      body: JSON.stringify({ food_name, kcal, grams }),
    }),
  diary: (initData: string) => req<DiaryEntry[]>('/api/diary', initData),
  addDiaryEntry: (initData: string, text: string, mood?: number) =>
    req<DiaryEntry & { xp_granted: XpGranted }>('/api/diary', initData, {
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
  archivedTasks: (initData: string) =>
    req<Task[]>('/api/tasks?archive=true', initData),
  diaryForDate: (initData: string, date: string) =>
    req<DiaryEntry[]>(`/api/diary?date=${encodeURIComponent(date)}`, initData),
  updateDiaryEntry: (initData: string, id: string, text: string, mood?: number) =>
    req<{ ok: boolean }>(`/api/diary/${id}`, initData, {
      method: 'PATCH',
      body: JSON.stringify({ text, mood: mood ?? null }),
    }),
  deleteDiaryEntry: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/diary/${id}`, initData, { method: 'DELETE' }),
  deleteFoodEntry: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/food/${id}`, initData, { method: 'DELETE' }),
  getBodyProfile: (initData: string) =>
    req<BodyData>('/api/users/body', initData),
  updateBodyProfile: (initData: string, data: Partial<BodyData>) =>
    req<{ ok: boolean; kcal_goal: number | null } & BodyData>('/api/users/body', initData, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true),
  xpHistory: (initData: string, days = 30) =>
    req<XpPoint[]>(`/api/xp-history?days=${days}`, initData),
  sleep: (initData: string) =>
    req<{ today: SleepEntry | null; history: SleepEntry[] }>('/api/sleep', initData),
  logSleep: (initData: string, sleep_time: string, wake_time: string) =>
    req<SleepEntry & { xp_granted: XpGranted }>('/api/sleep', initData, {
      method: 'POST',
      body: JSON.stringify({ sleep_time, wake_time }),
    }),
  finance: (initData: string) => req<Transaction[]>('/api/finance', initData),
  addSpend: (initData: string, amount: number, category: string) =>
    req<Transaction & { xp_granted: XpGranted }>('/api/finance', initData, {
      method: 'POST',
      body: JSON.stringify({ amount, category }),
    }),
  workouts: (initData: string) => req<Workout[]>('/api/workouts', initData),
  addWorkout: (initData: string, activity: string, duration_min?: number) =>
    req<Workout & { xp_granted: XpGranted }>('/api/workouts', initData, {
      method: 'POST',
      body: JSON.stringify({ activity, duration_min }),
    }),
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

export type XpGranted = { stat: string; amount: number } | null

export interface XpPoint {
  date: string
  xp: number
}

export interface SleepEntry {
  date: string
  sleep_time: string
  wake_time: string
  duration_min: number
}

export interface Transaction {
  id?: string
  date: string
  amount: number
  category: string
  note: string | null
}

export interface Workout {
  id?: string
  date: string
  activity: string
  duration_min: number | null
  type: string
}

export interface TodayData {
  level: number
  water: number
  water_goal: number
  rituals_done: number
  rituals_total: number
  tasks_done: number
  kcal: number
  kcal_goal: number | null
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
  completed_at?: string
}

export interface InboxItem {
  id: string
  text: string
  created_at: string
}

export interface DiaryEntry {
  id: string
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
  kcal_goal: number | null
  totals: { tasks_done: number; rituals_done: number }
  stats: Record<string, number>
}

export interface BodyData {
  weight_kg: number | null
  height_cm: number | null
  age: number | null
  activity_level: string | null
  sex: string | null
}
