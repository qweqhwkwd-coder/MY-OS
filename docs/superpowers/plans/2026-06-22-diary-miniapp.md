# Diary screen (Mini App, minimal v1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal "Дневник" (diary) screen to the Mini App — list of recent entries + add-entry form — matching the existing Notes.tsx pattern, with no archive-by-date or edit/delete (deferred).

**Architecture:** Two thin FastAPI routes in `backend/api_routes.py` wrapping existing `db.py` functions (no `db.py` changes). One new React page `Diary.tsx` using the already-built `BottomSheet`/`TextField` shared components. Wire into `NavGrid.tsx` (unlock tile) and `App.tsx` (routing).

**Tech Stack:** FastAPI (sync route handlers), Supabase (`supabase-py`), React 19 + TypeScript + Tailwind v4 (no test framework on either side — verification is `py_compile` / `tsc`+`vite build`+`eslint` / manual smoke scripts, per project convention).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-22-diary-miniapp-design.md` — follow exactly; archive-by-date and rename/delete are explicitly out of scope for this plan.
- No `db.py` changes — `get_diary_entries(user_id, limit=10)` and `add_diary_entry(user_id, text, mood=None)` already exist and are unmodified.
- XP grant on add: `add_xp(user_id, "reflection", 2, "journal")` — same stat/amount/source as the bot's `/journal` command.
- Mood emoji mapping: `{1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄'}` (matches `main.py`'s `MOOD_EMOJI`).
- No automated test suite exists in this project. Verification per task is: `python -m py_compile` for backend, a one-off smoke script run against the live local Supabase (via `backend/.venv`) for backend behavior, and `tsc -b && vite build` + `npm run lint` for frontend. This replaces the pytest-style red/green steps in the standard task template.
- Known local-environment caveat (discovered earlier this session): the local `.env`'s `SUPABASE_SERVICE_ROLE_KEY` does not bypass RLS for `INSERT` (confirmed via a failed test insert into `users`). The smoke script in Task 1 may hit the same wall on `POST /api/diary` — if so, report the exact error and fall back to `py_compile` + code review for that path, do not attempt to fix the credentials.

---

### Task 1: Backend — `GET /api/diary` and `POST /api/diary`

**Files:**
- Modify: `backend/api_routes.py` (import block, end of file)

**Interfaces:**
- Consumes: `db.get_diary_entries(user_id: str, limit: int = 10) -> list[dict]`, `db.add_diary_entry(user_id: str, text: str, mood: int | None = None) -> dict`, `db.add_xp(user_id: str, stat: str, amount: int, source: str) -> None` (all pre-existing, unmodified).
- Produces: `GET /api/diary` → `list[{date: str, text: str, mood: int | None}]`. `POST /api/diary` body `{text: str, mood?: int}` → returns the created row (dict, includes at least `date`, `text`, `mood`).

- [ ] **Step 1: Add the three new imports**

In `backend/api_routes.py`, the `from db import (...)` block currently reads (after the P1/P2 work earlier this session):

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
    parallel,
    rename_ritual,
    rename_task,
    toggle_ritual,
)
```

Replace it with (added: `add_diary_entry`, `add_xp`, `get_diary_entries`):

```python
from db import (
    DEFAULT_WATER_GOAL,
    RANKS,
    STATS,
    add_diary_entry,
    add_food,
    add_inbox,
    add_task,
    add_water,
    add_xp,
    calculate_hp,
    clear_inbox_item,
    complete_task,
    delete_ritual_by_id,
    delete_task_by_id,
    get_diary_entries,
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
)
```

- [ ] **Step 2: Add the two routes at the end of the file**

The file currently ends with:

```python
class FoodIn(BaseModel):
    food_name: str
    kcal: int
    grams: int | None = None


@router.post("/food")
def api_add_food_entry(body: FoodIn, user: dict = Depends(get_current_user)):
    return add_food(user["id"], body.food_name, body.kcal, body.grams)
```

Append after it:

```python


@router.get("/diary")
def api_diary(user: dict = Depends(get_current_user)):
    return get_diary_entries(user["id"], limit=10)


class DiaryIn(BaseModel):
    text: str
    mood: int | None = None


@router.post("/diary")
def api_add_diary_entry(body: DiaryIn, user: dict = Depends(get_current_user)):
    entry = add_diary_entry(user["id"], body.text, body.mood)
    add_xp(user["id"], "reflection", 2, "journal")
    return entry
```

- [ ] **Step 3: Byte-compile to catch syntax errors**

Run: `cd backend && python -m py_compile api_routes.py db.py main.py config.py`
Expected: no output, exit code 0.

- [ ] **Step 4: Smoke-test against the live local Supabase**

Create a temporary file `backend/_smoke_diary.py` (delete it after this step — it's not a permanent fixture, same as the throwaway script used for P1/P2 earlier this session):

```python
import api_routes
import db

users = db.supabase.table("users").select("*").limit(1).execute().data
if not users:
    print("No existing user row in local DB — GET/POST live test skipped, relying on py_compile + code review for this run")
else:
    user = users[0]

    entries = api_routes.api_diary(user=user)
    assert isinstance(entries, list), entries
    print(f"GET /api/diary -> {len(entries)} entries")
    if entries:
        assert set(entries[0].keys()) >= {"date", "text", "mood"}, entries[0]

    try:
        created = api_routes.api_add_diary_entry(
            api_routes.DiaryIn(text="smoke-test entry, safe to delete", mood=3), user=user
        )
        print(f"POST /api/diary -> created row keys: {sorted(created.keys())}")
        # Clean up the row we just inserted so this script doesn't leave test data behind
        db.supabase.table("diary_entries").delete().eq("id", created["id"]).execute()
        print("cleanup done")
    except Exception as e:
        print(f"POST /api/diary failed (may be the known local RLS/service-role-key issue): {e}")

print("SMOKE_DIARY_DONE")
```

Run from the repo root (so `.env` resolves — same gotcha as the P1/P2 smoke tests earlier):
```bash
cd "C:\Users\Asus\Documents\MY-OS"
PYTHONPATH=backend ./backend/.venv/Scripts/python.exe backend/_smoke_diary.py
```
Expected: `SMOKE_DIARY_DONE` printed. If there are no users in the local DB, the GET/POST checks are skipped with an explanatory message — that's fine, not a failure. If `POST` raises the RLS error from the Global Constraints note, that's a known pre-existing local-environment issue, not a bug in this task — record it and move on.

Then delete the scratch file:
```bash
rm backend/_smoke_diary.py
```

- [ ] **Step 5: Commit**

```bash
git add backend/api_routes.py
git commit -m "feat: add GET/POST /api/diary endpoints"
```

---

### Task 2: Frontend — `api.ts` client functions and `DiaryEntry` type

**Files:**
- Modify: `miniapp/src/api.ts`

**Interfaces:**
- Consumes: nothing new (uses the existing `req<T>()` helper already in this file).
- Produces: `api.diary(initData: string): Promise<DiaryEntry[]>`, `api.addDiaryEntry(initData: string, text: string, mood?: number): Promise<DiaryEntry>`, exported `interface DiaryEntry { date: string; text: string; mood: number | null }`.

- [ ] **Step 1: Add the two client functions**

Find this block (currently present in `api.ts`):

```typescript
  addFoodEntry: (initData: string, food_name: string, kcal: number, grams?: number) =>
    req<FoodEntry>('/api/food', initData, {
      method: 'POST',
      body: JSON.stringify({ food_name, kcal, grams }),
    }),
```

Add immediately after it:

```typescript
  diary: (initData: string) => req<DiaryEntry[]>('/api/diary', initData),
  addDiaryEntry: (initData: string, text: string, mood?: number) =>
    req<DiaryEntry>('/api/diary', initData, {
      method: 'POST',
      body: JSON.stringify({ text, mood }),
    }),
```

- [ ] **Step 2: Add the `DiaryEntry` interface**

Find this block:

```typescript
export interface InboxItem {
  id: string
  text: string
  created_at: string
}
```

Add immediately after it:

```typescript
export interface DiaryEntry {
  date: string
  text: string
  mood: number | null
}
```

- [ ] **Step 3: Type-check**

Run: `cd miniapp && npx tsc -b --noEmit`
Expected: no errors (this only type-checks `api.ts` in isolation since nothing imports the new symbols yet — full check happens in Task 3/4).

- [ ] **Step 4: Commit**

```bash
git add miniapp/src/api.ts
git commit -m "feat: add diary client functions and DiaryEntry type to api.ts"
```

---

### Task 3: Frontend — `Diary.tsx` page

**Files:**
- Create: `miniapp/src/pages/Diary.tsx`

**Interfaces:**
- Consumes: `api.diary(initData)`, `api.addDiaryEntry(initData, text, mood?)`, `DiaryEntry` (all from Task 2's `api.ts`); `BottomSheet({open, onClose, children})` and `TextField({value, onChange, multiline?, autoFocus?, placeholder?, ...})` (both pre-existing, from `miniapp/src/components/`).
- Produces: `Diary({initData, onDataChange}: {initData: string; onDataChange?: () => void})` — a React component, default export pattern matches every other page in `pages/` (named export, not default).

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DiaryEntry } from '../api'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

export function Diary({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    api.diary(initData)
      .then(d => { setEntries(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function closeModal() {
    setOpen(false)
    setText('')
    setMood(null)
    setSaveErr('')
  }

  async function handleAdd() {
    if (!text.trim()) return
    setSaving(true)
    setSaveErr('')
    try {
      const entry = await api.addDiaryEntry(initData, text.trim(), mood ?? undefined)
      setEntries(prev => [entry, ...prev])
      onDataChange?.()
      closeModal()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>…</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between items-center" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ЩОДЕННИК</span>
        <button
          onClick={() => setOpen(true)}
          className="font-condensed text-xs px-2 py-1"
          style={{ border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
        >
          + Новий запис
        </button>
      </div>

      {entries.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Записів немає.<br />Додай перший запис кнопкою вище.
        </div>
      )}

      <div>
        {entries.map((e, idx) => (
          <div key={idx} className="px-4 py-4" style={{ borderBottom: '1px solid var(--subtle)' }}>
            <div className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <span>{e.date}</span>
              {e.mood != null && <span>{MOOD_EMOJI[e.mood]}</span>}
            </div>
            <div className="font-condensed text-sm mt-1">{e.text}</div>
          </div>
        ))}
      </div>

      <BottomSheet open={open} onClose={closeModal}>
        <div className="p-6 space-y-4">
          {saveErr && (
            <div className="font-mono text-xs" style={{ color: '#dc2626' }}>{saveErr}</div>
          )}
          <div className="font-condensed font-semibold text-base">📓 Новий запис</div>
          <TextField
            autoFocus
            multiline
            value={text}
            onChange={setText}
            placeholder="Як минув день..."
          />
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(m => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? null : m)}
                className="flex-1 py-2 text-lg"
                style={{
                  border: '1px solid var(--subtle)',
                  background: mood === m ? 'var(--ink)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !text.trim()}
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

- [ ] **Step 2: Type-check (will still fail — expected)**

Run: `cd miniapp && npx tsc -b --noEmit`
Expected: `Diary.tsx` itself type-checks clean, but this is a good point to notice nothing imports it yet — that's Task 4. If `tsc` reports an error inside `Diary.tsx`, fix it now before proceeding.

- [ ] **Step 3: Commit**

```bash
git add miniapp/src/pages/Diary.tsx
git commit -m "feat: add Diary.tsx page (list + add, no archive/edit/delete yet)"
```

---

### Task 4: Wire into navigation — `NavGrid.tsx` and `App.tsx`

**Files:**
- Modify: `miniapp/src/components/NavGrid.tsx`
- Modify: `miniapp/src/App.tsx`

**Interfaces:**
- Consumes: `Diary` component from Task 3 (named export from `./pages/Diary`).
- Produces: nothing new for later tasks — this is the last task, it makes the feature reachable.

- [ ] **Step 1: Unlock the `diary` tile**

In `miniapp/src/components/NavGrid.tsx`, find:

```typescript
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: true  },
```

Change to:

```typescript
  { id: 'diary',   num: '09', label: 'Щоденник',  locked: false },
```

- [ ] **Step 2: Add the import and route in `App.tsx`**

In `miniapp/src/App.tsx`, find:

```typescript
import { Today } from './pages/Today'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'
import { Notes } from './pages/Notes'

type View = 'today' | 'water' | 'rituals' | 'tasks' | 'food' | 'notes'
```

Replace with:

```typescript
import { Today } from './pages/Today'
import { Water } from './pages/Water'
import { Rituals } from './pages/Rituals'
import { Tasks } from './pages/Tasks'
import { Food } from './pages/Food'
import { Notes } from './pages/Notes'
import { Diary } from './pages/Diary'

type View = 'today' | 'water' | 'rituals' | 'tasks' | 'food' | 'notes' | 'diary'
```

Find:

```typescript
      case 'food':    return <Food initData={initData} />
      case 'notes':   return <Notes initData={initData} onDataChange={refreshProfile} />
    }
```

Replace with:

```typescript
      case 'food':    return <Food initData={initData} />
      case 'notes':   return <Notes initData={initData} onDataChange={refreshProfile} />
      case 'diary':   return <Diary initData={initData} onDataChange={refreshProfile} />
    }
```

- [ ] **Step 3: Full build + lint**

Run: `cd miniapp && npm run build`
Expected: `tsc -b` then `vite build` both succeed, ends with `✓ built in ...`.

Run: `cd miniapp && npm run lint`
Expected: same pre-existing 3 errors / 2 warnings as before this plan (in `App.tsx:56`, `ActionSheet.tsx:22`, `WelcomeScreen.tsx:18`, `Today.tsx:33` — none of which this plan's diff touches). No NEW errors involving `Diary.tsx`, `NavGrid.tsx`, or the modified `App.tsx` lines.

- [ ] **Step 4: Commit**

```bash
git add miniapp/src/components/NavGrid.tsx miniapp/src/App.tsx
git commit -m "feat: unlock Diary tile in NavGrid, wire into App.tsx routing"
```

---

### Task 5: Code review and docs update

- [ ] **Step 1: Dispatch a code-reviewer subagent**

Follow `superpowers:requesting-code-review` — review the diff across all 4 commits in this plan (`git diff <sha before Task 1>..HEAD -- backend/api_routes.py miniapp/`) against this plan and the spec at `docs/superpowers/specs/2026-06-22-diary-miniapp-design.md`.

- [ ] **Step 2: Fix any Critical/Important findings, re-run the relevant verification step from the task that introduced them**

- [ ] **Step 3: Update `docs/claude/current-state.md`**

Two lines in this file are already stale even before this plan (they say "5 screens" but Notes.tsx already shipped, making it 6) — fix both the pre-existing undercount and add Diary in the same edit, per CLAUDE.md rule 11 (don't leave docs stale "for later").

Line 54 currently reads:
```
- `pages/{Today,Water,Rituals,Tasks,Food}.tsx` — экраны MVP-модулей.
```
Change to:
```
- `pages/{Today,Water,Rituals,Tasks,Food,Notes,Diary}.tsx` — экраны MVP-модулей.
```

Line 104 currently reads:
```
Mini App покрывает 5 экранов из ядра; остальные модули доступны только через бота.
```
Change to:
```
Mini App покрывает 7 экранов (Сьогодні/Вода/Ритуали/Завдання/Їжа/Нотатки/Щоденник); остальные модули доступны только через бота.
```

- [ ] **Step 4: Update `docs/claude/modules.md`**

Lines 10-14 currently read:
```
(`miniapp/src/components/NavGrid.tsx`) навигация — сетка 3×N плиток-модулей:
5 разблокированных (Сьогодні/Вода/Ритуали/Завдання/Їжа — экраны существуют)
+ 7 заблокированных плиток-заглушек (Сон/Фінанси/Цілі/Щоденник/Ідеї/Зустрічі/Дайджест —
у этих модулей есть бот-команды и API, но нет экрана в Mini App, плитки
существуют как видимый roadmap, но не открываются).
```
Change to (also fixes the pre-existing Notes omission, same reasoning as Step 3):
```
(`miniapp/src/components/NavGrid.tsx`) навигация — сетка 3×N плиток-модулей:
7 разблокированных (Сьогодні/Вода/Ритуали/Завдання/Їжа/Нотатки/Щоденник — экраны существуют)
+ 6 заблокированных плиток-заглушек (Сон/Фінанси/Цілі/Ідеї/Зустрічі/Дайджест —
у этих модулей есть бот-команды и API, но нет экрана в Mini App, плитки
существуют как видимый roadmap, но не открываются).
```

Lines 50-53 (the Дневник module entry) currently read:
```
## 06 · Дневник ✅ (базово)
Свободная запись (текст/голос/фото), настроение 1–5, теги, тепловая карта, статистика настроения.
**Сейчас:** `/journal` — текст + опц. настроение 1–5, архив по дате. Голос/фото, теги, тепловая карта — нет.
**RPG:** регулярные записи → Рефлексия (+2 XP за запись, реализовано).
```
Change the **Сейчас:** line to:
```
**Сейчас:** `/journal` (бот) и Mini App (минимальный экран — список последних 10 записей + додавання) — текст + опц. настроение 1–5. Архив по дате, редактирование/удаление записи (ни в боте, ни в Mini App), голос/фото, теги, тепловая карта — нет.
```

- [ ] **Step 5: Update `CLAUDE.md`**

Lines 5-6 currently read:
```
> **Текущее состояние:** MVP-ядро + 12 из 17 модулей продукта — в боте. Mini App
> покрывает 5 экранов ядра + профиль с RPG (ранг/HP/стрик). AI-слой не подключён.
```
Change `5 экранов` to `7 экранов`. The "12 из 17 модулей" count is unaffected (Дневник was already counted there as a bot module; this change is purely about Mini App screen coverage).

- [ ] **Step 6: Commit the docs update**

```bash
git add docs/claude/current-state.md docs/claude/modules.md CLAUDE.md
git commit -m "docs: record Diary screen added to Mini App, fix stale 5-screen count (Notes was already live)"
```
