# Mini App CRUD Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 3 reported gaps in the Mini App — no edit/delete for rituals and tasks, no way to view/sort notes added via the Inbox quick-add, and no grams field when adding food — per `docs/superpowers/specs/2026-06-21-miniapp-crud-completion-design.md`.

**Architecture:** Backend gets new ownership-checked CRUD functions in `db.py` + matching FastAPI routes in `api_routes.py`, following the exact patterns already used by every existing function/route in those files. Frontend gets one new shared `ActionSheet` component (bottom-sheet menu with built-in two-tap delete confirm) reused across `Rituals.tsx`, `Tasks.tsx`, and the new `Notes.tsx` page.

**Tech Stack:** Python 3.12 / FastAPI / Supabase (backend, unchanged), React 19 / TypeScript / Tailwind v4 (frontend, unchanged).

## Global Constraints

- **No automated test suite** (project convention — see `docs/claude/conventions.md`). Every backend task is verified with `python -m py_compile`; every frontend task is verified with `npm run build` (runs `tsc -b && vite build`, catches type errors — safe to run locally, writes only to the gitignored `dist/`, makes no network/DB calls). This replaces the red-green test steps a normal plan would have.
- **Commit after each task**, one task at a time (project rules 4 and 7 in `CLAUDE.md`) — do not batch multiple tasks into one commit.
- **Ukrainian UI text only** — every user-facing string in this plan is already in Ukrainian; keep it that way.
- **Reuse existing CSS variables** (`var(--bg)`, `var(--ink)`, `var(--muted)`, `var(--subtle)`, `var(--accent)`) and the existing inline-style + Tailwind-utility-class mix already used throughout `miniapp/src/pages/*.tsx` — do not introduce new colors or a new styling approach.
- **Every backend function takes `user_id` and filters by `.eq("user_id", user_id)`** — the ownership-check pattern used everywhere in `db.py`. No exceptions.
- All commands below assume the working directory is the repo root (`C:\Users\Asus\Documents\MY-OS`) unless stated otherwise.

---

### Task 1: Грами в формі додавання їжі

**Files:**
- Modify: `miniapp/src/pages/Today.tsx`

**Interfaces:**
- Consumes: `api.addFoodEntry(initData: string, food_name: string, kcal: number, grams?: number)` — already exists in `miniapp/src/api.ts`, `grams` param already typed but never passed from the UI.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Add grams state and reset it in `closeModal`**

In `miniapp/src/pages/Today.tsx`, find:

```tsx
  const [foodName, setFoodName] = useState('')
  const [foodKcal, setFoodKcal] = useState('')
```

Replace with:

```tsx
  const [foodName, setFoodName] = useState('')
  const [foodGrams, setFoodGrams] = useState('')
  const [foodKcal, setFoodKcal] = useState('')
```

Find:

```tsx
  function closeModal() {
    setModal(null)
    setSaveErr('')
    setTaskTitle('')
    setNoteText('')
    setFoodName('')
    setFoodKcal('')
  }
```

Replace with:

```tsx
  function closeModal() {
    setModal(null)
    setSaveErr('')
    setTaskTitle('')
    setNoteText('')
    setFoodName('')
    setFoodGrams('')
    setFoodKcal('')
  }
```

- [ ] **Step 2: Pass grams through in `handleAddFood`**

Find:

```tsx
  async function handleAddFood() {
    if (!foodName.trim() || !foodKcal) return
    setSaving(true)
    setSaveErr('')
    try { await api.addFoodEntry(initData, foodName.trim(), parseInt(foodKcal)); reload(); onDataChange?.(); closeModal() }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }
```

Replace with:

```tsx
  async function handleAddFood() {
    if (!foodName.trim() || !foodKcal) return
    setSaving(true)
    setSaveErr('')
    try {
      await api.addFoodEntry(initData, foodName.trim(), parseInt(foodKcal), foodGrams ? parseInt(foodGrams) : undefined)
      reload(); onDataChange?.(); closeModal()
    }
    catch (e: unknown) { setSaveErr(e instanceof Error ? e.message : 'Помилка') }
    finally { setSaving(false) }
  }
```

- [ ] **Step 3: Add the grams input between name and calories**

Find the food modal block:

```tsx
            {modal === 'food' && (
              <>
                <div className="font-condensed font-semibold text-base">🍽 Їжа</div>
                <input
                  autoFocus
                  value={foodName}
                  onChange={e => setFoodName(e.target.value)}
                  placeholder="Назва (Гречка, Яйця...)"
                  className="w-full px-0 py-3 font-condensed text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <input
                  value={foodKcal}
                  onChange={e => setFoodKcal(e.target.value.replace(/\D/g, ''))}
                  placeholder="Калорії (ккал)"
                  inputMode="numeric"
                  className="w-full px-0 py-3 font-mono text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <button
                  onClick={handleAddFood}
                  disabled={saving || !foodName.trim() || !foodKcal}
                  className="w-full py-3 font-condensed font-semibold text-sm"
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  Додати
                </button>
              </>
            )}
```

Replace with (grams input inserted between name and calories, matching the bot's `/addfood Назва [грами] ккал` order):

```tsx
            {modal === 'food' && (
              <>
                <div className="font-condensed font-semibold text-base">🍽 Їжа</div>
                <input
                  autoFocus
                  value={foodName}
                  onChange={e => setFoodName(e.target.value)}
                  placeholder="Назва (Гречка, Яйця...)"
                  className="w-full px-0 py-3 font-condensed text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <input
                  value={foodGrams}
                  onChange={e => setFoodGrams(e.target.value.replace(/\D/g, ''))}
                  placeholder="Грами (за бажанням)"
                  inputMode="numeric"
                  className="w-full px-0 py-3 font-mono text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <input
                  value={foodKcal}
                  onChange={e => setFoodKcal(e.target.value.replace(/\D/g, ''))}
                  placeholder="Калорії (ккал)"
                  inputMode="numeric"
                  className="w-full px-0 py-3 font-mono text-sm outline-none"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                />
                <button
                  onClick={handleAddFood}
                  disabled={saving || !foodName.trim() || !foodKcal}
                  className="w-full py-3 font-condensed font-semibold text-sm"
                  style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  Додати
                </button>
              </>
            )}
```

- [ ] **Step 4: Verify**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors (exit code 0).

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/pages/Today.tsx
git commit -m "feat: add optional grams field to add-food form"
```

---

### Task 2: Спільний компонент ActionSheet

**Files:**
- Create: `miniapp/src/components/ActionSheet.tsx`

**Interfaces:**
- Produces: `ActionSheet` component, props `{ open: boolean; onClose: () => void; items: ActionSheetItem[] }` where `ActionSheetItem = { label: string; onClick: () => void; danger?: boolean }`. Consumed by Tasks 5, 7, 9.

- [ ] **Step 1: Create the component**

Create `miniapp/src/components/ActionSheet.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

export interface ActionSheetItem {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  items: ActionSheetItem[]
}

export function ActionSheet({ open, onClose, items }: Props) {
  const [armedIndex, setArmedIndex] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setArmedIndex(null)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  if (!open) return null

  function handleClick(idx: number, item: ActionSheetItem) {
    if (!item.danger) {
      onClose()
      item.onClick()
      return
    }
    if (armedIndex === idx) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setArmedIndex(null)
      onClose()
      item.onClick()
      return
    }
    setArmedIndex(idx)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setArmedIndex(null), 2500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(26,26,26,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx, item)}
            className="w-full px-6 py-4 text-left font-condensed text-sm"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: idx < items.length - 1 ? '1px solid var(--subtle)' : 'none',
              color: item.danger && armedIndex === idx ? '#dc2626' : 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            {item.danger && armedIndex === idx ? 'Натисни ще раз' : item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

Note on the danger/confirm mechanic: a non-danger item fires immediately and closes the sheet. A danger item's first tap only "arms" it (relabels to "Натисни ще раз" for 2.5s); a second tap within that window fires `onClick` and closes the sheet. This is the single shared implementation of the two-tap delete confirm — `Rituals.tsx`, `Tasks.tsx`, and `Notes.tsx` get it for free by passing `danger: true` on their delete item.

- [ ] **Step 2: Verify**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors. (The component isn't imported anywhere yet, so this only checks it's syntactically and structurally valid TSX.)

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/components/ActionSheet.tsx
git commit -m "feat: add shared ActionSheet component with built-in two-tap delete confirm"
```

---

### Task 3: api.ts — нові методи клієнта

**Files:**
- Modify: `miniapp/src/api.ts`

**Interfaces:**
- Produces: `api.renameRitual`, `api.deleteRitual`, `api.renameTask`, `api.deleteTask`, `api.inbox`, `api.inboxToTask`, `api.inboxToDiary`, `api.inboxToIdea`, `api.inboxToMeeting`, `api.deleteInboxItem`, and the `InboxItem` type. Consumed by Tasks 5, 7, 9.
- Consumes: the existing `req<T>(path, initData, options?)` helper already in this file.

- [ ] **Step 1: Add the new client methods**

In `miniapp/src/api.ts`, find the end of the `api` object (the `addFoodEntry` entry is currently last):

```ts
  addFoodEntry: (initData: string, food_name: string, kcal: number, grams?: number) =>
    req<FoodEntry>('/api/food', initData, {
      method: 'POST',
      body: JSON.stringify({ food_name, kcal, grams }),
    }),
}
```

Replace with:

```ts
  addFoodEntry: (initData: string, food_name: string, kcal: number, grams?: number) =>
    req<FoodEntry>('/api/food', initData, {
      method: 'POST',
      body: JSON.stringify({ food_name, kcal, grams }),
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
```

- [ ] **Step 2: Add the `InboxItem` type**

In the same file, find the `Task` interface:

```ts
export interface Task {
  id: string
  title: string
  is_completed: boolean
}
```

Right after it, add:

```ts
export interface InboxItem {
  id: string
  text: string
  created_at: string
}
```

- [ ] **Step 3: Verify**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add miniapp/src/api.ts
git commit -m "feat: add api.ts client methods for ritual/task rename+delete and inbox sorting"
```

---

### Task 4: Backend — перейменування та видалення ритуалу

**Files:**
- Modify: `backend/db.py`
- Modify: `backend/api_routes.py`

**Interfaces:**
- Produces: `db.rename_ritual(ritual_id: str, user_id: str, title: str) -> bool`, `db.delete_ritual_by_id(ritual_id: str, user_id: str) -> bool`; routes `PATCH /api/rituals/{id}` and `DELETE /api/rituals/{id}`. Consumed by Task 5.

- [ ] **Step 1: Add the two functions to `db.py`**

In `backend/db.py`, find `delete_ritual_by_title` (it's right after `toggle_ritual` and the balance-wheel section, before the diary section comment):

```python
def delete_ritual_by_title(user_id: str, title: str) -> bool:
    res = (
        supabase.table("rituals")
        .update({"is_active": False})
        .eq("user_id", user_id)
        .ilike("title", _ilike_escape(title))
        .eq("is_active", True)
        .execute()
    )
    return bool(res.data)
```

Right after that function (before `def delete_task_by_title`), add:

```python
def rename_ritual(ritual_id: str, user_id: str, title: str) -> bool:
    res = (
        supabase.table("rituals")
        .update({"title": title})
        .eq("id", ritual_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def delete_ritual_by_id(ritual_id: str, user_id: str) -> bool:
    res = (
        supabase.table("rituals")
        .update({"is_active": False})
        .eq("id", ritual_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

- [ ] **Step 2: Add the two routes to `api_routes.py`**

In `backend/api_routes.py`, add `rename_ritual` and `delete_ritual_by_id` to the `from db import (...)` block (keep the existing alphabetical-ish grouping, insert near `get_rituals`/`get_ritual_streaks`):

```python
from db import (
    DEFAULT_WATER_GOAL,
    RANKS,
    STATS,
    add_food,
    add_inbox,
    add_task,
    add_water,
    calculate_hp,
    complete_task,
    delete_ritual_by_id,
    get_food_today,
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
    rename_ritual,
    toggle_ritual,
)
```

Then find:

```python
@router.post("/rituals/{ritual_id}/toggle")
def api_toggle_ritual(ritual_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    now_done, _xp_eligible = toggle_ritual(ritual_id, uid)
    return {"done": now_done}
```

Right after it, add:

```python
class RitualRenameIn(BaseModel):
    title: str


@router.patch("/rituals/{ritual_id}")
def api_rename_ritual(ritual_id: str, body: RitualRenameIn, user: dict = Depends(get_current_user)):
    ok = rename_ritual(ritual_id, user["id"], body.title)
    if not ok:
        raise HTTPException(status_code=404, detail="Ritual not found")
    return {"ok": True}


@router.delete("/rituals/{ritual_id}")
def api_delete_ritual(ritual_id: str, user: dict = Depends(get_current_user)):
    ok = delete_ritual_by_id(ritual_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Ritual not found")
    return {"ok": True}
```

- [ ] **Step 3: Verify**

Run: `python -m py_compile backend/db.py backend/api_routes.py`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/db.py backend/api_routes.py
git commit -m "feat: add ritual rename/delete endpoints (PATCH/DELETE /api/rituals/{id})"
```

---

### Task 5: Frontend — Rituals.tsx: перейменування + видалення

**Files:**
- Modify: `miniapp/src/pages/Rituals.tsx`

**Interfaces:**
- Consumes: `ActionSheet` (Task 2), `api.renameRitual`/`api.deleteRitual` (Task 3), `PATCH`/`DELETE /api/rituals/{id}` (Task 4).

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `miniapp/src/pages/Rituals.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Ritual } from '../api'
import { ActionSheet } from '../components/ActionSheet'

export function Rituals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [toggleErr, setToggleErr] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    api.rituals(initData)
      .then(d => { setRituals(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function toggle(id: string) {
    setToggling(id)
    setToggleErr('')
    try {
      const res = await api.toggleRitual(initData, id)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, done: res.done } : r))
      onDataChange?.()
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setToggling(null)
    }
  }

  function startRename(r: Ritual) {
    setMenuId(null)
    setEditingId(r.id)
    setEditValue(r.title)
  }

  async function submitRename() {
    if (!editingId || !editValue.trim()) { setEditingId(null); return }
    const id = editingId
    const title = editValue.trim()
    try {
      await api.renameRitual(initData, id, title)
      setRituals(prev => prev.map(r => r.id === id ? { ...r, title } : r))
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    setMenuId(null)
    try {
      await api.deleteRitual(initData, id)
      setRituals(prev => prev.filter(r => r.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setToggleErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const done = rituals.filter(r => r.done).length
  const menuRitual = rituals.find(r => r.id === menuId) ?? null

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>РИТУАЛИ</span>
        <span>{done}/{rituals.length}</span>
      </div>

      {toggleErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{toggleErr}</div>
      )}

      {rituals.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Немає ритуалів.<br />Додай через бот: /addritual Ранкова зарядка
        </div>
      )}

      <div>
        {rituals.map(r => (
          <div
            key={r.id}
            className="flex items-center justify-between px-4 py-4"
            style={{
              background: r.done ? 'var(--subtle)' : 'transparent',
              borderBottom: '1px solid var(--subtle)',
              opacity: toggling === r.id ? 0.5 : 1,
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
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
              {editingId === r.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitRename()}
                  onBlur={submitRename}
                  className="font-condensed text-sm outline-none flex-1"
                  style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}
                />
              ) : (
                <button
                  onClick={() => setMenuId(r.id)}
                  className="font-condensed text-sm text-left flex-1 truncate"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    textDecoration: r.done ? 'line-through' : 'none', opacity: r.done ? 0.5 : 1, color: 'var(--ink)',
                  }}
                >
                  {r.icon && `${r.icon} `}{r.title}
                </button>
              )}
            </div>
            {r.streak > 0 && (
              <span className="font-mono text-xs flex-shrink-0 ml-2" style={{ color: 'var(--muted)' }}>{r.streak}🔥</span>
            )}
          </div>
        ))}
      </div>

      <ActionSheet
        open={menuRitual !== null}
        onClose={() => setMenuId(null)}
        items={menuRitual ? [
          { label: 'Перейменувати', onClick: () => startRename(menuRitual) },
          { label: 'Видалити', danger: true, onClick: () => handleDelete(menuRitual.id) },
        ] : []}
      />
    </div>
  )
}
```

This replaces the old whole-row toggle button with: a checkbox button (toggle) + a separate title button (opens the menu) inside a plain row `<div>`, plus inline rename state and the `ActionSheet` for the menu.

- [ ] **Step 2: Verify**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Rituals.tsx
git commit -m "feat: add rename/delete to Rituals page via ActionSheet"
```

---

### Task 6: Backend — перейменування та видалення задачі

**Files:**
- Modify: `backend/db.py`
- Modify: `backend/api_routes.py`

**Interfaces:**
- Produces: `db.rename_task(task_id: str, user_id: str, title: str) -> bool`, `db.delete_task_by_id(task_id: str, user_id: str) -> bool`; routes `PATCH /api/tasks/{id}` and `DELETE /api/tasks/{id}`. Consumed by Task 7.

- [ ] **Step 1: Add the two functions to `db.py`**

In `backend/db.py`, find `delete_task_by_title`:

```python
def delete_task_by_title(user_id: str, title: str) -> bool:
    res = (
        supabase.table("tasks")
        .delete()
        .eq("user_id", user_id)
        .ilike("title", _ilike_escape(title))
        .eq("is_completed", False)
        .execute()
    )
    return bool(res.data)
```

Right after it, add:

```python
def rename_task(task_id: str, user_id: str, title: str) -> bool:
    res = (
        supabase.table("tasks")
        .update({"title": title})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def delete_task_by_id(task_id: str, user_id: str) -> bool:
    res = (
        supabase.table("tasks")
        .delete()
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

- [ ] **Step 2: Add the two routes to `api_routes.py`**

Add `rename_task` and `delete_task_by_id` to the `from db import (...)` block (it currently has `add_task` — keep that, add these two near it):

```python
from db import (
    DEFAULT_WATER_GOAL,
    RANKS,
    STATS,
    add_food,
    add_inbox,
    add_task,
    add_water,
    calculate_hp,
    complete_task,
    delete_ritual_by_id,
    delete_task_by_id,
    get_food_today,
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
    rename_ritual,
    rename_task,
    toggle_ritual,
)
```

Then find:

```python
@router.post("/tasks/{task_id}/complete")
def api_complete_task(task_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    done = complete_task(task_id, uid)
    return {"done": done}
```

Right after it, add:

```python
class TaskRenameIn(BaseModel):
    title: str


@router.patch("/tasks/{task_id}")
def api_rename_task(task_id: str, body: TaskRenameIn, user: dict = Depends(get_current_user)):
    ok = rename_task(task_id, user["id"], body.title)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


@router.delete("/tasks/{task_id}")
def api_delete_task(task_id: str, user: dict = Depends(get_current_user)):
    ok = delete_task_by_id(task_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}
```

- [ ] **Step 3: Verify**

Run: `python -m py_compile backend/db.py backend/api_routes.py`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/db.py backend/api_routes.py
git commit -m "feat: add task rename/delete endpoints (PATCH/DELETE /api/tasks/{id})"
```

---

### Task 7: Frontend — Tasks.tsx: перейменування + видалення

**Files:**
- Modify: `miniapp/src/pages/Tasks.tsx`

**Interfaces:**
- Consumes: `ActionSheet` (Task 2), `api.renameTask`/`api.deleteTask` (Task 3), `PATCH`/`DELETE /api/tasks/{id}` (Task 6).

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `miniapp/src/pages/Tasks.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../api'
import { ActionSheet } from '../components/ActionSheet'

export function Tasks({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [completeErr, setCompleteErr] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    api.tasks(initData)
      .then(d => { setTasks(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function complete(id: string) {
    setCompleting(id)
    setCompleteErr('')
    try {
      await api.completeTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setCompleting(null)
    }
  }

  function startRename(t: Task) {
    setMenuId(null)
    setEditingId(t.id)
    setEditValue(t.title)
  }

  async function submitRename() {
    if (!editingId || !editValue.trim()) { setEditingId(null); return }
    const id = editingId
    const title = editValue.trim()
    try {
      await api.renameTask(initData, id, title)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t))
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setEditingId(null)
    }
  }

  async function handleDelete(id: string) {
    setMenuId(null)
    try {
      await api.deleteTask(initData, id)
      setTasks(prev => prev.filter(t => t.id !== id))
      onDataChange?.()
    } catch (e: unknown) {
      setCompleteErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const menuTask = tasks.find(t => t.id === menuId) ?? null

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЗАВДАННЯ</span>
        <span>{tasks.length}</span>
      </div>

      {completeErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{completeErr}</div>
      )}

      {tasks.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Задач немає.<br />Додай через бот або кнопку «Задачу» на головній.
        </div>
      )}

      <div>
        {tasks.map(t => (
          <div
            key={t.id}
            className="flex items-center justify-between px-4 py-4"
            style={{ borderBottom: '1px solid var(--subtle)' }}
          >
            {editingId === t.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitRename()}
                onBlur={submitRename}
                className="font-condensed text-sm outline-none flex-1 mr-3"
                style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}
              />
            ) : (
              <button
                onClick={() => setMenuId(t.id)}
                className="font-condensed text-sm flex-1 mr-3 text-left truncate"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
              >
                {t.title}
              </button>
            )}
            <button
              onClick={() => complete(t.id)}
              disabled={completing === t.id}
              className="font-mono text-xs px-3 py-1 flex-shrink-0"
              style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', opacity: completing === t.id ? 0.4 : 1 }}
            >
              Готово
            </button>
          </div>
        ))}
      </div>

      <ActionSheet
        open={menuTask !== null}
        onClose={() => setMenuId(null)}
        items={menuTask ? [
          { label: 'Перейменувати', onClick: () => startRename(menuTask) },
          { label: 'Видалити', danger: true, onClick: () => handleDelete(menuTask.id) },
        ] : []}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Tasks.tsx
git commit -m "feat: add rename/delete to Tasks page via ActionSheet"
```

---

### Task 8: Backend — Inbox: перегляд + розбір (→ завдання/щоденник/ідея/зустріч) + видалення

**Files:**
- Modify: `backend/db.py`
- Modify: `backend/api_routes.py`

**Interfaces:**
- Produces: `db.inbox_to_task(item_id, user_id) -> dict | None`, `db.inbox_to_diary(item_id, user_id) -> dict | None`, `db.inbox_to_idea(item_id, user_id) -> dict | None`, `db.inbox_to_meeting(item_id, user_id, meeting_date, meeting_time=None) -> dict | None`; routes `GET /api/inbox`, `POST /api/inbox/{id}/to-task`, `/to-diary`, `/to-idea`, `/to-meeting`, `DELETE /api/inbox/{id}`.
- Consumes: existing `db.add_task`, `db.add_diary_entry`, `db.add_idea`, `db.add_meeting`, `db.get_inbox`, `db.clear_inbox_item`.

- [ ] **Step 1: Add the sort functions to `db.py`**

In `backend/db.py`, find `clear_inbox_item`:

```python
def clear_inbox_item(item_id: str, user_id: str) -> None:
    supabase.table("inbox_items").update({"is_handled": True}).eq("id", item_id).eq("user_id", user_id).execute()
```

Right after it, add:

```python
def _get_inbox_text(item_id: str, user_id: str) -> str | None:
    res = (
        supabase.table("inbox_items")
        .select("text")
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute()
    )
    return res.data[0]["text"] if res.data else None


def inbox_to_task(item_id: str, user_id: str) -> dict | None:
    text = _get_inbox_text(item_id, user_id)
    if text is None:
        return None
    task = add_task(user_id, text)
    clear_inbox_item(item_id, user_id)
    return task


def inbox_to_diary(item_id: str, user_id: str) -> dict | None:
    text = _get_inbox_text(item_id, user_id)
    if text is None:
        return None
    entry = add_diary_entry(user_id, text)
    clear_inbox_item(item_id, user_id)
    return entry


def inbox_to_idea(item_id: str, user_id: str) -> dict | None:
    text = _get_inbox_text(item_id, user_id)
    if text is None:
        return None
    idea = add_idea(user_id, text)
    clear_inbox_item(item_id, user_id)
    return idea


def inbox_to_meeting(item_id: str, user_id: str, meeting_date: str, meeting_time: str | None = None) -> dict | None:
    text = _get_inbox_text(item_id, user_id)
    if text is None:
        return None
    meeting = add_meeting(user_id, text, meeting_date, meeting_time)
    clear_inbox_item(item_id, user_id)
    return meeting
```

`add_diary_entry`, `add_idea`, and `add_meeting` are already defined earlier in this same file (diary/ideas/meetings sections), so no new imports are needed inside `db.py` itself.

- [ ] **Step 2: Add `import re` and the new routes to `api_routes.py`**

At the top of `backend/api_routes.py`, find:

```python
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl
```

Replace with:

```python
import hashlib
import hmac
import json
import re
import time
from urllib.parse import parse_qsl
```

Update the `from db import (...)` block to its final form for this file — adding `clear_inbox_item`, `get_inbox`, `inbox_to_task`, `inbox_to_diary`, `inbox_to_idea`, `inbox_to_meeting` to what Tasks 4 and 6 already put there:

```python
from db import (
    DEFAULT_WATER_GOAL,
    RANKS,
    STATS,
    add_food,
    add_inbox,
    add_task,
    add_water,
    calculate_hp,
    clear_inbox_item,
    complete_task,
    delete_ritual_by_id,
    delete_task_by_id,
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
    rename_ritual,
    rename_task,
    toggle_ritual,
)
```

Then find:

```python
@router.post("/inbox")
def api_add_inbox(body: InboxIn, user: dict = Depends(get_current_user)):
    return add_inbox(user["id"], body.text)
```

Right after it, add:

```python
@router.get("/inbox")
def api_inbox(user: dict = Depends(get_current_user)):
    return get_inbox(user["id"])


@router.post("/inbox/{item_id}/to-task")
def api_inbox_to_task(item_id: str, user: dict = Depends(get_current_user)):
    result = inbox_to_task(item_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return result


@router.post("/inbox/{item_id}/to-diary")
def api_inbox_to_diary(item_id: str, user: dict = Depends(get_current_user)):
    result = inbox_to_diary(item_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return result


@router.post("/inbox/{item_id}/to-idea")
def api_inbox_to_idea(item_id: str, user: dict = Depends(get_current_user)):
    result = inbox_to_idea(item_id, user["id"])
    if result is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return result


class MeetingFromInboxIn(BaseModel):
    date: str
    time: str | None = None


@router.post("/inbox/{item_id}/to-meeting")
def api_inbox_to_meeting(item_id: str, body: MeetingFromInboxIn, user: dict = Depends(get_current_user)):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", body.date):
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    result = inbox_to_meeting(item_id, user["id"], body.date, body.time)
    if result is None:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    return result


@router.delete("/inbox/{item_id}")
def api_delete_inbox_item(item_id: str, user: dict = Depends(get_current_user)):
    clear_inbox_item(item_id, user["id"])
    return {"ok": True}
```

Note: `DELETE /api/inbox/{id}` always returns `{"ok": True}` even if the item doesn't exist or was already handled — `clear_inbox_item` doesn't report whether a row matched (same as its existing behavior used by the bot's `/inbox` command), and marking an already-handled item handled again is harmless.

- [ ] **Step 3: Verify**

Run: `python -m py_compile backend/db.py backend/api_routes.py`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/db.py backend/api_routes.py
git commit -m "feat: add inbox list + sort-to-task/diary/idea/meeting + delete endpoints"
```

---

### Task 9: Frontend — Notes.tsx (нова сторінка) + NavGrid + App.tsx

**Files:**
- Create: `miniapp/src/pages/Notes.tsx`
- Modify: `miniapp/src/components/NavGrid.tsx`
- Modify: `miniapp/src/App.tsx`

**Interfaces:**
- Consumes: `ActionSheet` (Task 2), `api.inbox`/`api.inboxToTask`/`api.inboxToDiary`/`api.inboxToIdea`/`api.inboxToMeeting`/`api.deleteInboxItem` (Task 3), the 6 inbox routes (Task 8).

- [ ] **Step 1: Create `Notes.tsx`**

Create `miniapp/src/pages/Notes.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { InboxItem } from '../api'
import { ActionSheet } from '../components/ActionSheet'

export function Notes({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
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
    setMenuId(null)
    setActionErr('')
    try {
      await action()
      remove(id)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Помилка')
    }
  }

  function openMeetingForm(id: string) {
    setMenuId(null)
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

  const menuItem = items.find(i => i.id === menuId) ?? null

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>НОТАТКИ</span>
        <span>{items.length}</span>
      </div>

      {actionErr && (
        <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>
      )}

      {items.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Нотаток немає.<br />Додай кнопкою «Нотатку» на головній.
        </div>
      )}

      <div>
        {items.map(i => (
          <button
            key={i.id}
            onClick={() => setMenuId(i.id)}
            className="w-full text-left px-4 py-4"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', cursor: 'pointer' }}
          >
            <div className="font-condensed text-sm">{i.text}</div>
            <div className="font-mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {new Date(i.created_at).toLocaleDateString('uk-UA')}
            </div>
          </button>
        ))}
      </div>

      <ActionSheet
        open={menuItem !== null}
        onClose={() => setMenuId(null)}
        items={menuItem ? [
          { label: '→ Завдання', onClick: () => run(() => api.inboxToTask(initData, menuItem.id), menuItem.id) },
          { label: '→ Щоденник', onClick: () => run(() => api.inboxToDiary(initData, menuItem.id), menuItem.id) },
          { label: '→ Ідея', onClick: () => run(() => api.inboxToIdea(initData, menuItem.id), menuItem.id) },
          { label: '→ Зустріч', onClick: () => openMeetingForm(menuItem.id) },
          { label: 'Видалити', danger: true, onClick: () => run(() => api.deleteInboxItem(initData, menuItem.id), menuItem.id) },
        ] : []}
      />

      {meetingId && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          style={{ background: 'rgba(26,26,26,0.6)' }}
          onClick={() => setMeetingId(null)}
        >
          <div
            className="w-full p-6 space-y-4"
            style={{ background: 'var(--bg)', borderTop: '1px solid var(--subtle)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="font-condensed font-semibold text-base">📅 Зустріч — дата</div>
            <input
              autoFocus
              type="date"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
              className="w-full px-0 py-3 font-mono text-sm outline-none"
              style={{ background: 'transparent', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}
            />
            <input
              type="time"
              value={meetingTime}
              onChange={e => setMeetingTime(e.target.value)}
              className="w-full px-0 py-3 font-mono text-sm outline-none"
              style={{ background: 'transparent', borderBottom: '1px solid var(--subtle)', color: 'var(--ink)' }}
            />
            <button
              onClick={submitMeeting}
              disabled={!meetingDate}
              className="w-full py-3 font-condensed font-semibold text-sm"
              style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: meetingDate ? 1 : 0.5 }}
            >
              Створити зустріч
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Unlock the Notes tile in `NavGrid.tsx`**

In `miniapp/src/components/NavGrid.tsx`, find:

```tsx
const MODULES: Module[] = [
  { id: 'today',   num: '01', label: 'Сьогодні', locked: false },
  { id: 'water',   num: '02', label: 'Вода',      locked: false },
  { id: 'rituals', num: '03', label: 'Ритуали',   locked: false },
  { id: 'tasks',   num: '04', label: 'Завдання',  locked: false },
  { id: 'food',    num: '05', label: 'Їжа',       locked: false },
  { id: 'sleep',   num: '06', label: 'Сон',       locked: true  },
  { id: 'finance', num: '07', label: 'Фінанси',   locked: true  },
  { id: 'goals',   num: '08', label: 'Цілі',      locked: true  },
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: true  },
  { id: 'ideas',   num: '10', label: 'Ідеї',      locked: true  },
  { id: 'meet',    num: '11', label: 'Зустрічі',  locked: true  },
  { id: 'digest',  num: '12', label: 'Дайджест',  locked: true  },
]
```

Replace with:

```tsx
const MODULES: Module[] = [
  { id: 'today',   num: '01', label: 'Сьогодні', locked: false },
  { id: 'water',   num: '02', label: 'Вода',      locked: false },
  { id: 'rituals', num: '03', label: 'Ритуали',   locked: false },
  { id: 'tasks',   num: '04', label: 'Завдання',  locked: false },
  { id: 'food',    num: '05', label: 'Їжа',       locked: false },
  { id: 'sleep',   num: '06', label: 'Сон',       locked: true  },
  { id: 'finance', num: '07', label: 'Фінанси',   locked: true  },
  { id: 'goals',   num: '08', label: 'Цілі',      locked: true  },
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: true  },
  { id: 'ideas',   num: '10', label: 'Ідеї',      locked: true  },
  { id: 'meet',    num: '11', label: 'Зустрічі',  locked: true  },
  { id: 'digest',  num: '12', label: 'Дайджест',  locked: true  },
  { id: 'notes',   num: '13', label: 'Нотатки',   locked: false },
]
```

- [ ] **Step 3: Wire `Notes` into `App.tsx`**

In `miniapp/src/App.tsx`, find:

```tsx
import { Today } from './pages/Today'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'

type View = 'today' | 'water' | 'rituals' | 'tasks' | 'food'
```

Replace with:

```tsx
import { Today } from './pages/Today'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'
import { Notes } from './pages/Notes'

type View = 'today' | 'water' | 'rituals' | 'tasks' | 'food' | 'notes'
```

Find:

```tsx
  const page = (() => {
    switch (view) {
      case 'today':   return <Today initData={initData} onDataChange={refreshProfile} />
      case 'water':   return <Water initData={initData} onDataChange={refreshProfile} />
      case 'rituals': return <Rituals initData={initData} onDataChange={refreshProfile} />
      case 'tasks':   return <Tasks initData={initData} onDataChange={refreshProfile} />
      case 'food':    return <Food initData={initData} />
    }
  })()
```

Replace with:

```tsx
  const page = (() => {
    switch (view) {
      case 'today':   return <Today initData={initData} onDataChange={refreshProfile} />
      case 'water':   return <Water initData={initData} onDataChange={refreshProfile} />
      case 'rituals': return <Rituals initData={initData} onDataChange={refreshProfile} />
      case 'tasks':   return <Tasks initData={initData} onDataChange={refreshProfile} />
      case 'food':    return <Food initData={initData} />
      case 'notes':   return <Notes initData={initData} onDataChange={refreshProfile} />
    }
  })()
```

- [ ] **Step 4: Verify**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/pages/Notes.tsx miniapp/src/components/NavGrid.tsx miniapp/src/App.tsx
git commit -m "feat: add Notes page with inbox sorting, unlock Notes tile in NavGrid"
```

---

### Task 10: Фінальна перевірка

**Files:** none (verification only).

- [ ] **Step 1: Full backend compile check**

Run: `python -m py_compile backend/*.py`
Expected: no output, exit code 0.

- [ ] **Step 2: Full frontend build**

Run: `cd miniapp && npm run build`
Expected: builds with no TypeScript errors, no warnings about unused `InboxItem`/`ActionSheet` imports.

- [ ] **Step 3: Manual smoke-test checklist (for the user, after deploying)**

This plan adds no automated tests (project convention) and the changes touch real production data, so the actual functional check happens after deploy, by hand, in the real Mini App:

- Rituals: tap a ritual's name → menu opens → Перейменувати → rename → saved. Tap checkbox → still toggles independently. Tap name → menu → Видалити → tap again within ~2.5s → ritual disappears.
- Tasks: same checks (rename via row tap, delete with two-tap confirm, "Готово" still completes independently).
- Notes: add a note via "📋 Нотатку" on Today, open the new "13 · Нотатки" tile, see it listed. Try all 5 actions: → Завдання, → Щоденник, → Ідея each remove it from the list immediately; → Зустріч asks for a date first, then removes it; Видалити needs the two-tap confirm.
- Food: open "🍽 Їжу" quick-add, confirm the new "Грами (за бажанням)" field is between name and calories, and that an entry saved with grams shows it on the Food page (e.g. "Гречка 100г").

No code changes in this step — it's a checklist, not a task to implement.
