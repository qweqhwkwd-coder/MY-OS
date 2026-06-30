# Mini App UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Додати свайп-видалення/редагування до всіх блоків, архів завдань, КБЖУ-профіль, покращити щоденник і WelcomeScreen.

**Architecture:** SwipeRow — єдиний компонент для delete/edit у всіх сторінках, замінює LongPressButton. Backend отримує нові ендпоінти для diary CRUD, tasks archive, food delete, body profile. ProfileModal отримує третій вид 'body' з КБЖУ-калькулятором.

**Tech Stack:** React 19, TypeScript, Tailwind v4, IBM Plex fonts, FastAPI, Supabase (supabase-py sync)

## Global Constraints

- `git add <specific files>` — ніколи `git add -A`
- Backend syntax: `python -m py_compile backend/db.py backend/api_routes.py`
- Frontend build: `cd miniapp && npm run build`
- Міграція застосовується вручну в Supabase SQL Editor перед деплоєм backend
- Нових таблиць Supabase немає — тільки `ALTER TABLE users`
- Шрифти: `IBM Plex Sans Condensed` (UI), `IBM Plex Mono` (числа/дані)
- Кольори: `--bg #f8f7f4`, `--ink #1a1a1a`, `--muted #999`, `--accent #4338ca`

---

### Task 1: DB Migration + backend/db.py — нові функції

**Files:**
- Create: `db/migrations/015_body_profile.sql`
- Modify: `backend/db.py`

**Interfaces:**
- Produces: `calculate_kcal_goal(user_id: str) -> int | None`
- Produces: `update_body_profile(user_id, weight_kg, height_cm, age, activity_level) -> None`
- Produces: `get_body_profile(user_id: str) -> dict`
- Produces: `get_archived_tasks(user_id: str) -> list[dict]`
- Produces: `update_diary_entry(entry_id, user_id, text, mood) -> bool`
- Produces: `delete_diary_entry(entry_id, user_id) -> bool`
- Produces: `delete_food_entry(entry_id, user_id) -> bool`
- Modifies: `get_diary_entries` — додає `id` до SELECT

- [ ] **Step 1: Створити файл міграції**

Створити `db/migrations/015_body_profile.sql`:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'moderate';
```

- [ ] **Step 2: Застосувати міграцію вручну**

Відкрити Supabase SQL Editor → вставити SQL з файлу вище → Run. Очікувана відповідь: `ALTER TABLE`.

- [ ] **Step 3: Додати ACTIVITY_MULTIPLIERS і calculate_kcal_goal у db.py**

У `backend/db.py`, після блоку `RANKS` (приблизно після рядка з `RANKS = [`), додати:

```python
ACTIVITY_MULTIPLIERS = {
    'low': 1.2,
    'moderate': 1.375,
    'active': 1.55,
    'very_active': 1.725,
}


def calculate_kcal_goal(user_id: str) -> int | None:
    """TDEE за формулою Міффліна. Повертає None якщо профіль тіла неповний."""
    res = supabase.table("users").select("weight_kg,height_cm,age,activity_level").eq("id", user_id).execute()
    if not res.data:
        return None
    u = res.data[0]
    w, h, a = u.get("weight_kg"), u.get("height_cm"), u.get("age")
    if not all([w, h, a]):
        return None
    bmr = 10 * float(w) + 6.25 * int(h) - 5 * int(a) + 5
    multiplier = ACTIVITY_MULTIPLIERS.get(u.get("activity_level") or "moderate", 1.375)
    return round(bmr * multiplier)


def get_body_profile(user_id: str) -> dict:
    res = supabase.table("users").select("weight_kg,height_cm,age,activity_level").eq("id", user_id).execute()
    return res.data[0] if res.data else {}


def update_body_profile(user_id: str, weight_kg: float | None, height_cm: int | None, age: int | None, activity_level: str | None) -> None:
    update: dict = {}
    if weight_kg is not None:
        update["weight_kg"] = weight_kg
    if height_cm is not None:
        update["height_cm"] = height_cm
    if age is not None:
        update["age"] = age
    if activity_level is not None:
        update["activity_level"] = activity_level
    if update:
        supabase.table("users").update(update).eq("id", user_id).execute()
```

- [ ] **Step 4: Додати get_archived_tasks у db.py**

Після функції `get_tasks` у розділі `# --- Задачи ---`:

```python
def get_archived_tasks(user_id: str) -> list[dict]:
    """Виконані задачі за останні 30 днів, від нових до старих."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    return (
        supabase.table("tasks")
        .select("id,title,completed_at")
        .eq("user_id", user_id)
        .eq("is_completed", True)
        .gte("completed_at", cutoff)
        .order("completed_at", desc=True)
        .execute()
        .data
    )
```

- [ ] **Step 5: Оновити get_diary_entries — додати id до SELECT**

Знайти функцію `get_diary_entries` у `backend/db.py`. Замінити рядок:
```python
        .select("date,text,mood")
```
На:
```python
        .select("id,date,text,mood")
```

Також змінити `limit=10` → `limit=30` у підписі функції:
```python
def get_diary_entries(user_id: str, limit: int = 30) -> list[dict]:
```

- [ ] **Step 6: Додати update_diary_entry, delete_diary_entry, delete_food_entry у db.py**

Після функції `add_diary_entry`:

```python
def update_diary_entry(entry_id: str, user_id: str, text: str, mood: int | None) -> bool:
    res = (
        supabase.table("diary_entries")
        .update({"text": text, "mood": mood})
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def delete_diary_entry(entry_id: str, user_id: str) -> bool:
    res = (
        supabase.table("diary_entries")
        .delete()
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

Після функції `add_food` у розділі `# --- Питание ---`:

```python
def delete_food_entry(entry_id: str, user_id: str) -> bool:
    res = (
        supabase.table("food_logs")
        .delete()
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

- [ ] **Step 7: Перевірити синтаксис**

```bash
python -m py_compile backend/db.py
```
Очікується: без виводу (без помилок).

- [ ] **Step 8: Commit**

```bash
git add db/migrations/015_body_profile.sql backend/db.py
git commit -m "feat: add body profile, КБЖУ calc, task archive, diary/food delete to db.py"
```

---

### Task 2: backend/api_routes.py — нові ендпоінти

**Files:**
- Modify: `backend/api_routes.py`

**Interfaces:**
- Consumes: всі функції з Task 1
- Produces: `GET /api/tasks?archive=true`
- Produces: `GET /api/diary?date=YYYY-MM-DD` (опціональний параметр)
- Produces: `PATCH /api/diary/{entry_id}`
- Produces: `DELETE /api/diary/{entry_id}`
- Produces: `DELETE /api/food/{entry_id}`
- Produces: `GET /api/users/body`
- Produces: `PATCH /api/users/body`
- Modifies: `GET /api/today` — додає `kcal_goal`
- Modifies: `GET /api/profile` — додає `kcal_goal`

- [ ] **Step 1: Оновити імпорти з db у api_routes.py**

Знайти блок `from db import (` і додати нові функції:

```python
from db import (
    ACTIVITY_MULTIPLIERS,
    DEFAULT_WATER_GOAL,
    RANKS,
    STATS,
    add_diary_entry,
    add_food,
    add_inbox,
    add_ritual,
    add_task,
    add_water,
    add_xp,
    calculate_hp,
    calculate_kcal_goal,
    clear_inbox_item,
    complete_task,
    delete_diary_entry,
    delete_food_entry,
    delete_ritual_by_id,
    delete_task_by_id,
    get_archived_tasks,
    get_body_profile,
    get_diary_entries,
    get_diary_entries_by_date,
    get_food_today,
    get_inbox,
    get_rank,
    get_rituals,
    get_rituals_done_today,
    get_ritual_streaks,
    get_streak,
    get_tasks,
    get_tasks_done_today,
    get_user_stats,
    get_water_today,
    get_week_digest,
    get_xp_today,
    ensure_user,
    inbox_to_diary,
    inbox_to_idea,
    inbox_to_meeting,
    inbox_to_task,
    parallel,
    rename_ritual,
    rename_task,
    toggle_ritual,
    update_body_profile,
    update_diary_entry,
)
```

- [ ] **Step 2: Оновити GET /api/today — додати kcal_goal**

Знайти функцію `api_today`. Замінити весь її вміст на:

```python
@router.get("/today")
def api_today(user: dict = Depends(get_current_user)):
    uid = user["id"]
    water, rituals, done_set, tasks_done, food, stats, kcal_goal = parallel(
        lambda: get_water_today(uid),
        lambda: get_rituals(uid),
        lambda: get_rituals_done_today(uid),
        lambda: get_tasks_done_today(uid),
        lambda: get_food_today(uid),
        lambda: get_user_stats(uid),
        lambda: calculate_kcal_goal(uid),
    )
    kcal = sum(e["kcal"] for e in food if e.get("kcal") is not None)
    return {
        "level": stats["level"],
        "water": water,
        "water_goal": user.get("water_goal") or DEFAULT_WATER_GOAL,
        "rituals_done": sum(1 for r in rituals if r["id"] in done_set),
        "rituals_total": len(rituals),
        "tasks_done": tasks_done,
        "kcal": kcal,
        "kcal_goal": kcal_goal,
    }
```

- [ ] **Step 3: Оновити GET /api/profile — додати kcal_goal**

Знайти функцію `api_profile`. Замінити весь її вміст на:

```python
@router.get("/profile")
def api_profile(user: dict = Depends(get_current_user)):
    uid = user["id"]
    stats, hp, xp_today, streak, kcal_goal = parallel(
        lambda: get_user_stats(uid),
        lambda: calculate_hp(uid, user.get("water_goal")),
        lambda: get_xp_today(uid),
        lambda: get_streak(uid),
        lambda: calculate_kcal_goal(uid),
    )
    avg_xp = sum(stats[s] for s in STATS) / 8
    rank_data = get_rank(avg_xp)
    return {
        "name": user.get("name", ""),
        "level": stats["level"],
        "xp_total": int(sum(stats[s] for s in STATS)),
        "xp_today": xp_today,
        "streak": streak,
        "hp": hp,
        "kcal_goal": kcal_goal,
        **rank_data,
        "stats": {s: stats[s] for s in STATS},
    }
```

- [ ] **Step 4: Оновити GET /api/tasks — додати параметр archive**

Знайти `@router.get("/tasks")` і замінити:

```python
@router.get("/tasks")
def api_tasks(archive: bool = False, user: dict = Depends(get_current_user)):
    if archive:
        return get_archived_tasks(user["id"])
    return get_tasks(user["id"])
```

- [ ] **Step 5: Оновити GET /api/diary — додати параметр date**

Знайти `@router.get("/diary")` і замінити:

```python
@router.get("/diary")
def api_diary(date: str | None = None, user: dict = Depends(get_current_user)):
    if date:
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
        return get_diary_entries_by_date(user["id"], date)
    return get_diary_entries(user["id"])
```

- [ ] **Step 6: Додати PATCH і DELETE для diary**

Після блоку `@router.post("/diary")` додати:

```python
class DiaryUpdateIn(BaseModel):
    text: str
    mood: int | None = None


@router.patch("/diary/{entry_id}")
def api_update_diary(entry_id: str, body: DiaryUpdateIn, user: dict = Depends(get_current_user)):
    ok = update_diary_entry(entry_id, user["id"], body.text, body.mood)
    if not ok:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    return {"ok": True}


@router.delete("/diary/{entry_id}")
def api_delete_diary(entry_id: str, user: dict = Depends(get_current_user)):
    ok = delete_diary_entry(entry_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    return {"ok": True}
```

- [ ] **Step 7: Додати DELETE для food**

Після блоку `@router.post("/food")` додати:

```python
@router.delete("/food/{entry_id}")
def api_delete_food(entry_id: str, user: dict = Depends(get_current_user)):
    ok = delete_food_entry(entry_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Food entry not found")
    return {"ok": True}
```

- [ ] **Step 8: Додати GET і PATCH для /users/body**

В кінець файлу додати:

```python
class BodyIn(BaseModel):
    weight_kg: float | None = None
    height_cm: int | None = None
    age: int | None = None
    activity_level: str | None = None


@router.get("/users/body")
def api_get_body(user: dict = Depends(get_current_user)):
    return get_body_profile(user["id"])


@router.patch("/users/body")
def api_update_body(body: BodyIn, user: dict = Depends(get_current_user)):
    update_body_profile(user["id"], body.weight_kg, body.height_cm, body.age, body.activity_level)
    kcal_goal = calculate_kcal_goal(user["id"])
    profile = get_body_profile(user["id"])
    return {"ok": True, "kcal_goal": kcal_goal, **profile}
```

- [ ] **Step 9: Перевірити синтаксис**

```bash
python -m py_compile backend/db.py backend/api_routes.py
```
Очікується: без виводу.

- [ ] **Step 10: Commit**

```bash
git add backend/api_routes.py
git commit -m "feat: add diary CRUD, food delete, task archive, body profile endpoints; kcal_goal in today/profile"
```

---

### Task 3: SwipeRow component

**Files:**
- Create: `miniapp/src/components/SwipeRow.tsx`

**Interfaces:**
- Produces: `SwipeRow` component, `SwipeAction` interface (exported)
- Props: `id`, `openId`, `onOpen`, `onClose`, `actions: SwipeAction[]`, `children`, `style?`, `className?`

- [ ] **Step 1: Створити SwipeRow.tsx**

Створити `miniapp/src/components/SwipeRow.tsx`:

```tsx
import { useRef, useState, useEffect } from 'react'

export interface SwipeAction {
  label: string
  bgColor: string
  onClick: () => void
}

interface Props {
  id: string
  openId: string | null
  onOpen: (id: string) => void
  onClose: () => void
  actions: SwipeAction[]
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const ACTION_W = 72

export function SwipeRow({ id, openId, onOpen, onClose, actions, children, style, className }: Props) {
  const totalW = actions.length * ACTION_W
  const isOpen = openId === id
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const currentX = useRef(0)
  const touching = useRef(false)

  useEffect(() => {
    if (!isOpen) setOffset(0)
  }, [isOpen])

  function onTouchStart(e: React.TouchEvent) {
    touching.current = true
    startX.current = e.touches[0].clientX
    currentX.current = e.touches[0].clientX
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touching.current) return
    currentX.current = e.touches[0].clientX
    const base = isOpen ? -totalW : 0
    const raw = base + (currentX.current - startX.current)
    setOffset(Math.max(-totalW, Math.min(0, raw)))
  }

  function onTouchEnd() {
    touching.current = false
    const delta = currentX.current - startX.current
    const isTap = Math.abs(delta) < 5

    if (isOpen && isTap) {
      setOffset(0)
      onClose()
      return
    }

    if (offset < -totalW / 2) {
      setOffset(-totalW)
      onOpen(id)
    } else {
      setOffset(0)
      if (isOpen) onClose()
    }
  }

  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={style}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Action buttons — sit behind the content on the right */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: totalW }}>
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => { a.onClick(); onClose() }}
            className="flex items-center justify-center font-condensed text-xs font-semibold"
            style={{ width: ACTION_W, background: a.bgColor, color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Content slides left to reveal actions */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: touching.current ? 'none' : 'transform 200ms ease',
          background: 'var(--bg)',
          position: 'relative',
        }}
      >
        {isOpen && (
          <div
            className="absolute inset-0"
            style={{ zIndex: 10 }}
            onClick={() => { setOffset(0); onClose() }}
          />
        )}
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```
Очікується: успішний build без нових помилок.

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/components/SwipeRow.tsx
git commit -m "feat: add SwipeRow universal swipe-to-action component"
```

---

### Task 4: api.ts — оновити типи і функції

**Files:**
- Modify: `miniapp/src/api.ts`

**Interfaces:**
- Modifies: `DiaryEntry` — додає `id: string`
- Modifies: `TodayData` — додає `kcal_goal: number | null`
- Modifies: `ProfileData` — додає `kcal_goal: number | null`
- Modifies: `Task` — додає `completed_at?: string`
- Produces: `BodyData` interface
- Produces: `api.archivedTasks`, `api.updateDiaryEntry`, `api.deleteDiaryEntry`, `api.diaryForDate`, `api.deleteFoodEntry`, `api.getBodyProfile`, `api.updateBodyProfile`

- [ ] **Step 1: Оновити інтерфейси у api.ts**

Знайти `export interface DiaryEntry` і замінити на:

```typescript
export interface DiaryEntry {
  id: string
  date: string
  text: string
  mood: number | null
}
```

Знайти `export interface TodayData` і замінити на:

```typescript
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
```

Знайти `export interface ProfileData` і додати поле після `next_rank_xp_min`:

```typescript
  kcal_goal: number | null
```

Знайти `export interface Task` і додати поле:

```typescript
  completed_at?: string
```

В кінець файлу після `ProfileData` додати:

```typescript
export interface BodyData {
  weight_kg: number | null
  height_cm: number | null
  age: number | null
  activity_level: string | null
}
```

- [ ] **Step 2: Додати нові функції до об'єкта api**

У `miniapp/src/api.ts`, знайти об'єкт `api` і додати після `deleteTask`:

```typescript
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
    }),
```

- [ ] **Step 3: Перевірити build**

```bash
cd miniapp && npm run build
```
Очікується: успішний build. TypeScript може показати помилки у сторінках де `DiaryEntry` використовується без `id` — вони виправляться у наступних tasks.

- [ ] **Step 4: Commit**

```bash
git add miniapp/src/api.ts
git commit -m "feat: update api.ts types and add archivedTasks, diary/food CRUD, body profile functions"
```

---

### Task 5: Tasks.tsx — свайп + архів + text wrap

**Files:**
- Modify: `miniapp/src/pages/Tasks.tsx`

**Interfaces:**
- Consumes: `SwipeRow`, `SwipeAction` з `../components/SwipeRow`
- Consumes: `api.archivedTasks`, `api.deleteTask`, `api.renameTask`, `api.completeTask`
- Consumes: `BottomSheet`, `TextField` (вже імпортовані або є в проекті)

- [ ] **Step 1: Переписати Tasks.tsx повністю**

Замінити весь вміст `miniapp/src/pages/Tasks.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

type Tab = 'active' | 'archive'

export function Tasks({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [tab, setTab] = useState<Tab>('active')
  const [tasks, setTasks] = useState<Task[]>([])
  const [archived, setArchived] = useState<Task[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [err, setErr] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Task | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.tasks(initData)
      .then(d => { setTasks(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function loadArchive() {
    if (archived !== null) return
    setArchiveLoading(true)
    try {
      const d = await api.archivedTasks(initData)
      setArchived(d)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setArchiveLoading(false)
    }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setOpenId(null)
    if (t === 'archive') loadArchive()
  }

  async function complete(id: string) {
    setCompleting(id)
    setActionErr('')
    setSuccessMsg('')
    try {
      const { done } = await api.completeTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      if (done) {
        setSuccessMsg('+3 XP до Дисципліни')
        onDataChange?.()
      }
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setCompleting(null)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      setArchived(prev => prev ? prev.filter(t => t.id !== id) : null)
      onDataChange?.()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function startEdit(t: Task) {
    setOpenId(null)
    setEditItem(t)
    setEditValue(t.title)
  }

  function closeEdit() {
    setEditItem(null)
    setEditValue('')
  }

  async function submitEdit() {
    if (!editItem || !editValue.trim()) { closeEdit(); return }
    setSaving(true)
    try {
      await api.renameTask(initData, editItem.id, editValue.trim())
      setTasks(prev => prev.map(t => t.id === editItem.id ? { ...t, title: editValue.trim() } : t))
      closeEdit()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })

  return (
    <div style={{ color: 'var(--ink)' }}>
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--subtle)' }}>
        {(['active', 'archive'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className="flex-1 py-2 font-mono text-xs"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--ink)' : '2px solid transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {t === 'active' ? `АКТИВНІ ${tasks.length > 0 ? tasks.length : ''}` : 'АРХІВ'}
          </button>
        ))}
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}
      {successMsg && <div className="px-4 py-2 text-xs font-mono" style={{ color: 'var(--accent)' }}>{successMsg}</div>}

      {/* Active tab */}
      {tab === 'active' && (
        <>
          {tasks.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Задач немає.<br />Додай через бот або кнопку «Задачу» на головній.
            </div>
          )}
          {tasks.map(t => (
            <SwipeRow
              key={t.id}
              id={t.id}
              openId={openId}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
              actions={[
                { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(t) },
                { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(t.id) },
              ]}
              style={{ borderBottom: '1px solid var(--subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-4 gap-3">
                <span
                  className="font-condensed text-sm flex-1 line-clamp-2"
                  style={{ color: 'var(--ink)' }}
                >
                  {t.title}
                </span>
                <button
                  onClick={() => complete(t.id)}
                  disabled={completing === t.id}
                  className="font-mono text-xs px-3 py-1 flex-shrink-0"
                  style={{
                    border: '1px solid var(--ink)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    opacity: completing === t.id ? 0.4 : 1,
                  }}
                >
                  Готово
                </button>
              </div>
            </SwipeRow>
          ))}
        </>
      )}

      {/* Archive tab */}
      {tab === 'archive' && (
        <>
          {archiveLoading && <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>}
          {archived !== null && archived.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Виконаних задач за останні 30 днів немає.
            </div>
          )}
          {archived?.map(t => (
            <SwipeRow
              key={t.id}
              id={t.id}
              openId={openId}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
              actions={[
                { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(t.id) },
              ]}
              style={{ borderBottom: '1px solid var(--subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-4 gap-3">
                <span className="font-condensed text-sm flex-1 line-clamp-2" style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>
                  {t.title}
                </span>
                {t.completed_at && (
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                    {formatDate(t.completed_at)}
                  </span>
                )}
              </div>
            </SwipeRow>
          ))}
        </>
      )}

      {/* Edit BottomSheet */}
      <BottomSheet open={editItem !== null} onClose={closeEdit}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">✏️ Редагувати завдання</div>
          <TextField
            autoFocus
            value={editValue}
            onChange={setEditValue}
            onEnter={submitEdit}
            placeholder="Назва завдання..."
          />
          <button
            onClick={submitEdit}
            disabled={saving || !editValue.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            Зберегти
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```
Очікується: без нових TypeScript помилок.

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Tasks.tsx
git commit -m "feat: Tasks — swipe edit/delete, archive tab, line-clamp-2 text"
```

---

### Task 6: Rituals.tsx — замінити LongPress на SwipeRow

**Files:**
- Modify: `miniapp/src/pages/Rituals.tsx`

**Interfaces:**
- Consumes: `SwipeRow` з `../components/SwipeRow`
- Removes: `LongPressButton`, `ActionSheet` imports
- Keeps: BottomSheet для додавання (без змін), edit тепер через BottomSheet

- [ ] **Step 1: Переписати Rituals.tsx**

Замінити весь вміст `miniapp/src/pages/Rituals.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Ritual } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

export function Rituals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Ritual | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState('')

  useEffect(() => {
    api.rituals(initData)
      .then(d => { setRituals(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function toggle(id: string) {
    setToggling(id)
    setActionErr('')
    try {
      const res = await api.toggleRitual(initData, id)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, done: res.done } : r))
      onDataChange?.()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteRitual(initData, id)
      setRituals(prev => prev.filter(r => r.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function startEdit(r: Ritual) {
    setOpenId(null)
    setEditItem(r)
    setEditValue(r.title)
  }

  function closeEdit() { setEditItem(null); setEditValue('') }

  async function submitEdit() {
    if (!editItem || !editValue.trim()) { closeEdit(); return }
    setSaving(true)
    try {
      await api.renameRitual(initData, editItem.id, editValue.trim())
      setRituals(prev => prev.map(r => r.id === editItem.id ? { ...r, title: editValue.trim() } : r))
      closeEdit()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  function closeAdd() { setAddOpen(false); setNewTitle(''); setAddErr('') }

  async function handleAdd() {
    if (!newTitle.trim()) return
    setAdding(true)
    setAddErr('')
    try {
      const created = await api.addRitual(initData, newTitle.trim())
      setRituals(prev => [...prev, { ...created, done: false, streak: 0 }])
      closeAdd()
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const done = rituals.filter(r => r.done).length

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between items-center" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>РИТУАЛИ</span>
        <div className="flex items-center gap-3">
          <span>{done}/{rituals.length}</span>
          <button
            onClick={() => setAddOpen(true)}
            className="font-condensed text-xs px-2 py-1"
            style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
          >
            + Ритуал
          </button>
        </div>
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {rituals.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Немає ритуалів. Додай кнопкою вище.
        </div>
      )}

      {rituals.map(r => (
        <SwipeRow
          key={r.id}
          id={r.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(r) },
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(r.id) },
          ]}
          style={{
            borderBottom: '1px solid var(--subtle)',
            background: r.done ? 'var(--subtle)' : 'transparent',
            opacity: toggling === r.id ? 0.5 : 1,
          }}
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <button
              onClick={() => toggle(r.id)}
              disabled={toggling === r.id}
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px solid ${r.done ? 'var(--ink)' : 'var(--muted)'}`,
                background: r.done ? 'var(--ink)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {r.done && <span style={{ fontSize: '10px', color: 'var(--bg)' }}>✓</span>}
            </button>
            <span
              className="font-condensed text-sm flex-1 line-clamp-2"
              style={{
                color: 'var(--ink)',
                textDecoration: r.done ? 'line-through' : 'none',
                opacity: r.done ? 0.5 : 1,
              }}
            >
              {r.icon && `${r.icon} `}{r.title}
            </span>
            {r.streak > 0 && (
              <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{r.streak}🔥</span>
            )}
          </div>
        </SwipeRow>
      ))}

      {/* Edit BottomSheet */}
      <BottomSheet open={editItem !== null} onClose={closeEdit}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">✏️ Редагувати ритуал</div>
          <TextField
            autoFocus
            value={editValue}
            onChange={setEditValue}
            onEnter={submitEdit}
            placeholder="Назва ритуалу..."
          />
          <button
            onClick={submitEdit}
            disabled={saving || !editValue.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            Зберегти
          </button>
        </div>
      </BottomSheet>

      {/* Add BottomSheet */}
      <BottomSheet open={addOpen} onClose={closeAdd}>
        <div className="p-6 space-y-4">
          {addErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{addErr}</div>}
          <div className="font-condensed font-semibold text-base">🔥 Новий ритуал</div>
          <TextField
            autoFocus
            value={newTitle}
            onChange={setNewTitle}
            onEnter={handleAdd}
            placeholder="Назва ритуалу..."
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: adding ? 0.5 : 1 }}
          >
            Додати
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Rituals.tsx
git commit -m "feat: Rituals — replace LongPress with SwipeRow, edit via BottomSheet"
```

---

### Task 7: Notes.tsx — замінити LongPress на SwipeRow

**Files:**
- Modify: `miniapp/src/pages/Notes.tsx`

**Interfaces:**
- Consumes: `SwipeRow` з `../components/SwipeRow`
- Keeps: BottomSheet з опціями конвертації (відкривається через кнопку «Опції»)
- Removes: `LongPressButton`, `ActionSheet`

- [ ] **Step 1: Переписати Notes.tsx**

Замінити весь вміст `miniapp/src/pages/Notes.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { InboxItem } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

export function Notes({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [optionsItem, setOptionsItem] = useState<InboxItem | null>(null)
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')

  useEffect(() => {
    api.inbox(initData)
      .then(d => { setItems(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    onDataChange?.()
  }

  async function run(action: () => Promise<unknown>, id: string) {
    setOptionsItem(null)
    setActionErr('')
    try {
      await action()
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteInboxItem(initData, id)
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function openOptions(item: InboxItem) {
    setOpenId(null)
    setOptionsItem(item)
  }

  function openMeetingForm(id: string) {
    setOptionsItem(null)
    setMeetingId(id)
    setMeetingDate('')
    setMeetingTime('')
  }

  async function submitMeeting() {
    if (!meetingId || !meetingDate) return
    const id = meetingId
    setActionErr('')
    try {
      await api.inboxToMeeting(initData, id, meetingDate, meetingTime || undefined)
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setMeetingId(null)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>НОТАТКИ</span>
        <span>{items.length}</span>
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {items.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нотаток немає.<br />Додай кнопкою «Нотатку» на головній.
        </div>
      )}

      {items.map(i => (
        <SwipeRow
          key={i.id}
          id={i.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Опції', bgColor: '#374151', onClick: () => openOptions(i) },
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(i.id) },
          ]}
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <div className="px-4 py-4">
            <div className="font-condensed text-sm line-clamp-2">{i.text}</div>
            <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {new Date(i.created_at).toLocaleDateString('uk-UA')}
            </div>
          </div>
        </SwipeRow>
      ))}

      {/* Options BottomSheet */}
      <BottomSheet open={optionsItem !== null} onClose={() => setOptionsItem(null)}>
        {optionsItem && (
          <div className="p-6 space-y-2">
            <div className="font-condensed font-semibold text-base mb-3">Конвертувати в...</div>
            {[
              { label: '→ Завдання', action: () => run(() => api.inboxToTask(initData, optionsItem.id), optionsItem.id) },
              { label: '→ Щоденник', action: () => run(() => api.inboxToDiary(initData, optionsItem.id), optionsItem.id) },
              { label: '→ Ідея', action: () => run(() => api.inboxToIdea(initData, optionsItem.id), optionsItem.id) },
              { label: '→ Зустріч', action: () => openMeetingForm(optionsItem.id) },
            ].map(opt => (
              <button
                key={opt.label}
                onClick={opt.action}
                className="w-full py-3 font-condensed text-sm text-left px-3"
                style={{ background: 'var(--subtle)', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* Meeting BottomSheet */}
      <BottomSheet open={meetingId !== null} onClose={() => setMeetingId(null)}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">📅 Зустріч — дата</div>
          <TextField autoFocus type="date" font="mono" value={meetingDate} onChange={setMeetingDate} />
          <TextField type="time" font="mono" border="subtle" value={meetingTime} onChange={setMeetingTime} />
          <button
            onClick={submitMeeting}
            disabled={!meetingDate}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: meetingDate ? 1 : 0.5 }}
          >
            Створити зустріч
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Notes.tsx
git commit -m "feat: Notes — replace LongPress with SwipeRow, options via BottomSheet"
```

---

### Task 8: Diary.tsx — свайп + редагування + фільтр по даті

**Files:**
- Modify: `miniapp/src/pages/Diary.tsx`

**Interfaces:**
- Consumes: `SwipeRow`, `api.updateDiaryEntry`, `api.deleteDiaryEntry`, `api.diaryForDate`
- `DiaryEntry` тепер має поле `id`

- [ ] **Step 1: Переписати Diary.tsx**

Замінити весь вміст `miniapp/src/pages/Diary.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DiaryEntry } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

export function Diary({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addText, setAddText] = useState('')
  const [addMood, setAddMood] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [editItem, setEditItem] = useState<DiaryEntry | null>(null)
  const [editText, setEditText] = useState('')
  const [editMood, setEditMood] = useState<number | null>(null)
  const [actionErr, setActionErr] = useState('')

  function loadEntries(date?: string) {
    setLoading(true)
    const req = date ? api.diaryForDate(initData, date) : api.diary(initData)
    req
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }

  useEffect(() => { loadEntries() }, [initData])

  function handleDateChange(d: string) {
    setFilterDate(d)
    loadEntries(d || undefined)
  }

  function closeAdd() { setAddOpen(false); setAddText(''); setAddMood(null); setSaveErr('') }

  async function handleAdd() {
    if (!addText.trim()) return
    setSaving(true)
    setSaveErr('')
    try {
      const entry = await api.addDiaryEntry(initData, addText.trim(), addMood ?? undefined)
      setEntries(prev => [entry, ...prev])
      onDataChange?.()
      closeAdd()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(e: DiaryEntry) {
    setOpenId(null)
    setEditItem(e)
    setEditText(e.text)
    setEditMood(e.mood)
  }

  function closeEdit() { setEditItem(null); setEditText(''); setEditMood(null) }

  async function submitEdit() {
    if (!editItem || !editText.trim()) { closeEdit(); return }
    setSaving(true)
    try {
      await api.updateDiaryEntry(initData, editItem.id, editText.trim(), editMood ?? undefined)
      setEntries(prev => prev.map(e => e.id === editItem.id ? { ...e, text: editText.trim(), mood: editMood } : e))
      closeEdit()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteDiaryEntry(initData, id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between items-center gap-2" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЩОДЕННИК</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={e => handleDateChange(e.target.value)}
            className="font-mono text-xs px-2 py-1"
            style={{ border: '1px solid var(--subtle)', background: 'transparent', color: 'var(--muted)', outline: 'none' }}
          />
          <button
            onClick={() => setAddOpen(true)}
            className="font-condensed text-xs px-2 py-1"
            style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
          >
            + Запис
          </button>
        </div>
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          {filterDate ? 'Записів за цю дату немає.' : 'Записів немає. Додай перший запис кнопкою вище.'}
        </div>
      )}

      {entries.map(e => (
        <SwipeRow
          key={e.id}
          id={e.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Редаг.', bgColor: '#374151', onClick: () => startEdit(e) },
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(e.id) },
          ]}
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <div className="px-4 py-4">
            <div className="font-mono text-xs flex items-center gap-2 mb-1" style={{ color: 'var(--muted)' }}>
              <span>{e.date}</span>
              {e.mood != null && <span>{MOOD_EMOJI[e.mood]}</span>}
            </div>
            <div className="font-condensed text-sm">{e.text}</div>
          </div>
        </SwipeRow>
      ))}

      {/* Add BottomSheet */}
      <BottomSheet open={addOpen} onClose={closeAdd}>
        <div className="p-6 space-y-4">
          {saveErr && <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>}
          <div className="font-condensed font-semibold text-base">📓 Новий запис</div>
          <TextField autoFocus multiline value={addText} onChange={setAddText} placeholder="Як минув день..." />
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setAddMood(addMood === m ? null : m)}
                className="flex-1 py-2 text-lg"
                style={{ border: '1px solid var(--subtle)', background: addMood === m ? 'var(--ink)' : 'transparent', cursor: 'pointer' }}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !addText.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            Зберегти
          </button>
        </div>
      </BottomSheet>

      {/* Edit BottomSheet */}
      <BottomSheet open={editItem !== null} onClose={closeEdit}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">✏️ Редагувати запис</div>
          <TextField autoFocus multiline value={editText} onChange={setEditText} placeholder="Текст запису..." />
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setEditMood(editMood === m ? null : m)}
                className="flex-1 py-2 text-lg"
                style={{ border: '1px solid var(--subtle)', background: editMood === m ? 'var(--ink)' : 'transparent', cursor: 'pointer' }}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
          <button
            onClick={submitEdit}
            disabled={saving || !editText.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            Зберегти
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Diary.tsx
git commit -m "feat: Diary — swipe edit/delete, date filter, edit BottomSheet"
```

---

### Task 9: Food.tsx — свайп видалення + ціль ккал

**Files:**
- Modify: `miniapp/src/pages/Food.tsx`

**Interfaces:**
- Consumes: `SwipeRow`, `api.deleteFoodEntry`
- `FoodEntry.id` вже є в інтерфейсі

- [ ] **Step 1: Переписати Food.tsx**

Замінити весь вміст `miniapp/src/pages/Food.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { FoodEntry } from '../api'
import { SwipeRow } from '../components/SwipeRow'

interface Props {
  initData: string
  kcalGoal?: number | null
}

export function Food({ initData, kcalGoal }: Props) {
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')

  useEffect(() => {
    api.food(initData)
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteFoodEntry(initData, id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  const total = entries.reduce((s, e) => s + (e.kcal ?? 0), 0)
  const pct = kcalGoal && kcalGoal > 0 ? Math.min(100, Math.round((total / kcalGoal) * 100)) : null

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЇЖА — СЬОГОДНІ</span>
        <span>{total}{kcalGoal ? ` / ${kcalGoal}` : ''} ккал</span>
      </div>

      {pct !== null && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--subtle)' }}>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--subtle)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: pct >= 100 ? '#dc2626' : '#f97316' }}
            />
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>{pct}% від денної норми</div>
        </div>
      )}

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нічого не записано.<br />Додай через бот або кнопку «Їжу» на головній.
        </div>
      )}

      {entries.map(e => (
        <SwipeRow
          key={e.id}
          id={e.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Видалити', bgColor: '#dc2626', onClick: () => handleDelete(e.id) },
          ]}
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-condensed text-sm flex-1 mr-3 line-clamp-1">
              {e.food_name}{e.grams != null ? ` ${e.grams}г` : ''}
            </span>
            <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{e.kcal} ккал</span>
          </div>
        </SwipeRow>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Оновити App.tsx — передати kcalGoal в Food**

У `miniapp/src/App.tsx` знайти рядок де рендериться `<Food initData={initData} />` і замінити на:

```tsx
case 'food':    return <Food initData={initData} kcalGoal={profile?.kcal_goal} />
```

- [ ] **Step 3: Перевірити build**

```bash
cd miniapp && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add miniapp/src/pages/Food.tsx miniapp/src/App.tsx
git commit -m "feat: Food — swipe delete, kcal goal progress bar"
```

---

### Task 10: Today.tsx — прогрес-бар ккал відносно цілі

**Files:**
- Modify: `miniapp/src/pages/Today.tsx`

- [ ] **Step 1: Оновити рядок калорій у Today.tsx**

У `miniapp/src/pages/Today.tsx` знайти секцію «Калорії» (рядок з `🍽 Калорії`). Замінити весь `<div className="px-4 py-4 flex items-center justify-between">` блок калорій на:

```tsx
{/* Calories */}
<div className="px-4 py-4 space-y-2" style={{ borderBottom: '1px solid var(--subtle)' }}>
  <div className="flex items-center justify-between">
    <span className="font-condensed text-sm">🍽 Калорії</span>
    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
      {data.kcal}{data.kcal_goal ? ` / ${data.kcal_goal}` : ''} ккал
    </span>
  </div>
  {data.kcal_goal && (
    <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--subtle)' }}>
      <div
        className="h-1.5 rounded-full"
        style={{
          width: `${Math.min(100, Math.round((data.kcal / data.kcal_goal) * 100))}%`,
          background: data.kcal >= data.kcal_goal ? '#dc2626' : '#f97316',
        }}
      />
    </div>
  )}
</div>
```

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Today.tsx
git commit -m "feat: Today — kcal progress bar vs goal"
```

---

### Task 11: ProfileModal.tsx — вкладка «Тіло» з КБЖУ

**Files:**
- Modify: `miniapp/src/components/ProfileModal.tsx`

**Interfaces:**
- Consumes: `api.getBodyProfile`, `api.updateBodyProfile`, `BodyData` з `../api`
- Modifies: `view` state — додає `'body'`

- [ ] **Step 1: Оновити ProfileModal.tsx**

Знайти рядок `const [view, setView] = useState<'profile' | 'settings'>('profile')` і замінити тип:

```tsx
const [view, setView] = useState<'profile' | 'settings' | 'body'>('profile')
```

Знайти блок `{view === 'settings' && (` — перед ним вставити новий блок для body view. Додати стан і функції після `const [view, ...]`:

```tsx
  const [bodyData, setBodyData] = useState<{ weight_kg: string; height_cm: string; age: string; activity_level: string }>({
    weight_kg: '', height_cm: '', age: '', activity_level: 'moderate',
  })
  const [bodyLoading, setBodyLoading] = useState(false)
  const [bodySaving, setBodySaving] = useState(false)
  const [bodyKcal, setBodyKcal] = useState<number | null>(profile.kcal_goal ?? null)

  function openBody() {
    setView('body')
    setBodyLoading(true)
    api.getBodyProfile(/* initData needed — see note below */)
  }
```

**Важливо:** ProfileModal не має доступу до `initData`. Потрібно передати його як prop. Знайти `interface Props` і додати:

```tsx
interface Props {
  profile: ProfileData
  onClose: () => void
  theme: Theme
  onThemeChange: (t: Theme) => void
  initData: string   // ← додати
}
```

Та оновити підпис функції:

```tsx
export function ProfileModal({ profile, onClose, theme, onThemeChange, initData }: Props) {
```

Потім у `miniapp/src/App.tsx` знайти `<ProfileModal` і додати `initData={initData}`.

Тепер повністю додати body view у компонент. Знайти `{view === 'settings' && (` і перед ним вставити:

```tsx
      {view === 'body' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
            ФІЗИЧНИЙ ПРОФІЛЬ
          </div>

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
                setBodSaving(true)
                try {
                  const res = await api.updateBodyProfile(initData, {
                    weight_kg: bodyData.weight_kg ? parseFloat(bodyData.weight_kg) : undefined,
                    height_cm: bodyData.height_cm ? parseInt(bodyData.height_cm) : undefined,
                    age: bodyData.age ? parseInt(bodyData.age) : undefined,
                    activity_level: bodyData.activity_level || undefined,
                  })
                  if (res.kcal_goal) setBodyKcal(res.kcal_goal)
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
        </div>
      )}
```

**Виправити typo у кнопці save:** `setBodSaving` → `setBodySaving`.

Знайти блок кнопок у header (де є ⚙️) і додати кнопку 💪 перед ⚙️:

```tsx
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
                ...existing settings button...
              >
                ⚙️
              </button>
            </>
          )}
```

Також додати `← Профіль` back-button для body view у header. Знайти:

```tsx
        {view === 'settings' ? (
          <button onClick={() => setView('profile')} ...>← Профіль</button>
        ) : (
```

Замінити на:

```tsx
        {(view === 'settings' || view === 'body') ? (
          <button onClick={() => setView('profile')} ...>← Профіль</button>
        ) : (
```

Додати завантаження bodyData при відкритті — додати `useEffect`:

```tsx
  useEffect(() => {
    if (view !== 'body') return
    api.getBodyProfile(initData).then(d => {
      setBodyData({
        weight_kg: d.weight_kg != null ? String(d.weight_kg) : '',
        height_cm: d.height_cm != null ? String(d.height_cm) : '',
        age: d.age != null ? String(d.age) : '',
        activity_level: d.activity_level ?? 'moderate',
      })
    }).catch(() => {})
  }, [view])
```

- [ ] **Step 2: Додати import BodyData і api в ProfileModal**

На початку `ProfileModal.tsx` додати:

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'
import type { ProfileData, BodyData } from '../api'
```

(замінити існуючий `import { useState }`)

- [ ] **Step 3: Перевірити build**

```bash
cd miniapp && npm run build
```
TypeScript покаже помилки якщо `initData` не передається з App.tsx. Виправити App.tsx щоб передавав `initData={initData}` у ProfileModal.

- [ ] **Step 4: Commit**

```bash
git add miniapp/src/components/ProfileModal.tsx miniapp/src/App.tsx
git commit -m "feat: ProfileModal — add Тіло tab with КБЖУ calculator"
```

---

### Task 12: WelcomeScreen.tsx — цитати при кожному відкритті

**Files:**
- Modify: `miniapp/src/components/WelcomeScreen.tsx`

- [ ] **Step 1: Прибрати localStorage-логіку з WelcomeScreen.tsx**

Знайти функцію `shouldShowWelcome` і замінити:

```typescript
export function shouldShowWelcome(): boolean {
  return true
}
```

Знайти функцію `handleEnter` всередині компонента і замінити:

```typescript
  function handleEnter() {
    onEnter()
  }
```

(прибираємо `localStorage.setItem(...)`)

Видалити функцію `todayStr()` — вона більше не потрібна.

- [ ] **Step 2: Перевірити build**

```bash
cd miniapp && npm run build
```
Очікується: успішний build.

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/components/WelcomeScreen.tsx
git commit -m "fix: WelcomeScreen — show quotes on every open, not once per day"
```

---

## Post-Sprint Checklist

- [ ] Деплой — запушити всі коміти, Render і GitHub Pages задеплояться автоматично
- [ ] Smoke test у Telegram — відкрити Mini App, перевірити:
  - WelcomeScreen показується кожного разу
  - Tasks: свайп вліво на задачі → Редаг./Видалити; вкладка Архів
  - Rituals: свайп вліво → Редаг./Видалити
  - Notes: свайп вліво → Опції/Видалити
  - Diary: свайп вліво → Редаг./Видалити; фільтр по даті
  - Food: свайп вліво → Видалити; прогрес-бар ккал
  - ProfileModal → 💪 → форма тіла → зберегти → з'явилося КБЖУ
  - Today: kcal прогрес-бар якщо профіль тіла заповнений

## Що НЕ входить у цей спринт

- Стать у КБЖУ (додати пізніше)
- Видалення записів води
- Нові сторінки у NavGrid (Сон, Фінанси, Цілі)
- Rank-up анімація
