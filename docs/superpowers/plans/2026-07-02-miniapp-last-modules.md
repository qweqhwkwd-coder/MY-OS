# Mini App Last Modules (Đ¦Ń–Đ»Ń–, Đ†Đ´ĐµŃ—, Đ—ŃŃŃ‚Ń€Ń–Ń‡Ń–, Đ”Đ°ĐąĐ´Đ¶ĐµŃŃ‚) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Unlock the last 4 NavGrid modules â€” Goals (08), Ideas (10), Meetings (11), Digest (12) â€” with full CRUD pages in Paper OS style; after this the Â«ĐˇĐšĐžĐ Đž: â€¦Â» line disappears.

**Architecture:** Backend adds REST endpoints over existing `goals`/`ideas`/`meetings` tables (no migrations); `GET /api/digest` already exists. Frontend adds 4 pages following existing patterns (Tasks.tsx for Goals, SwipeRow+BottomSheet everywhere), unlocks modules in NavGrid one commit per module.

**Tech Stack:** FastAPI + supabase-py, React 19 + TypeScript + Tailwind v4, Vite.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-miniapp-last-modules-design.md`
- UI language: Ukrainian. Paper OS style: `font-condensed` labels, `font-mono` data, colors only via CSS vars (`var(--ink)`, `var(--bg)`, `var(--muted)`, `var(--subtle)`), errors `#dc2626`.
- No new Supabase tables/migrations.
- XP for goal completion: +10 discipline, +5 reflection, source `goals` (parity with bot `cb_goal`).
- Verification: `python -m py_compile backend/db.py backend/api_routes.py` (no test suite exists) and `cd miniapp && npm run build`.
- Commit + push after each task (project rule 7). `git add` specific files only.
- Touch targets â‰Ą 44px, `haptic()` on taps, XP toasts via `useToast` + `xpToastText`.

---

### Task 1: Backend â€” db.py functions + REST endpoints

**Files:**
- Modify: `backend/db.py` (goals section ~line 729, ideas section ~line 764, meetings section ~line 641)
- Modify: `backend/api_routes.py` (import block line 14-73, append endpoints at end)

**Interfaces:**
- Produces: `get_goals(user_id, archive=False)`, `update_goal(goal_id, user_id, title, deadline) -> bool`, `delete_goal(goal_id, user_id) -> bool`, `update_idea(idea_id, user_id, text) -> bool`, `delete_idea(idea_id, user_id) -> bool`, `update_meeting(meeting_id, user_id, title, meeting_date, meeting_time) -> bool`, `delete_meeting(meeting_id, user_id) -> bool`
- Produces REST: `GET/POST /api/goals`, `POST /api/goals/{id}/complete` â†’ `{done, xp_granted}`, `PATCH/DELETE /api/goals/{id}`, `GET/POST /api/ideas`, `PATCH/DELETE /api/ideas/{id}`, `GET/POST /api/meetings`, `PATCH/DELETE /api/meetings/{id}`

- [x] **Step 1: Replace `get_goals` in `backend/db.py` (currently returns only active)**

```python
def get_goals(user_id: str, archive: bool = False) -> list[dict]:
    q = (
        supabase.table("goals")
        .select("id,title,deadline,is_done,done_at")
        .eq("user_id", user_id)
        .eq("is_done", archive)
    )
    if archive:
        q = q.order("done_at", desc=True).limit(30)
    else:
        q = q.order("created_at")
    return q.execute().data
```

(Bot callers use `get_goals(user["id"])` â€” default keeps old behavior.)

- [x] **Step 2: Add `update_goal` / `delete_goal` after `complete_goal` in db.py**

```python
def update_goal(goal_id: str, user_id: str, title: str, deadline: str | None) -> bool:
    res = (
        supabase.table("goals")
        .update({"title": title, "deadline": deadline})
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def delete_goal(goal_id: str, user_id: str) -> bool:
    res = (
        supabase.table("goals")
        .delete()
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

- [x] **Step 3: Ideas â€” bump limit 10â†’50 in `get_ideas`, add `update_idea` / `delete_idea` after it**

In `get_ideas` change `.limit(10)` â†’ `.limit(50)`.

```python
def update_idea(idea_id: str, user_id: str, text: str) -> bool:
    res = (
        supabase.table("ideas")
        .update({"text": text})
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def delete_idea(idea_id: str, user_id: str) -> bool:
    res = (
        supabase.table("ideas")
        .delete()
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

- [x] **Step 4: Meetings â€” return `id`, add update/delete**

In `get_upcoming_meetings` change `.select("title,date,time")` â†’ `.select("id,title,date,time")` and `.limit(10)` â†’ `.limit(20)`. Add after it:

```python
def update_meeting(meeting_id: str, user_id: str, title: str, meeting_date: str, meeting_time: str | None) -> bool:
    res = (
        supabase.table("meetings")
        .update({"title": title, "date": meeting_date, "time": meeting_time})
        .eq("id", meeting_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def delete_meeting(meeting_id: str, user_id: str) -> bool:
    res = (
        supabase.table("meetings")
        .delete()
        .eq("id", meeting_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)
```

- [x] **Step 5: api_routes.py â€” extend the `from db import (...)` block**

Add (alphabetical position, matching existing style): `add_goal`, `add_idea`, `add_meeting`, `complete_goal`, `delete_goal`, `delete_idea`, `delete_meeting`, `get_goals`, `get_ideas`, `get_upcoming_meetings`, `update_goal`, `update_idea`, `update_meeting`.

- [x] **Step 6: Append endpoints to the bottom of api_routes.py**

```python
# --- Đ¦Ń–Đ»Ń– ----------------------------------------------------------------------


class GoalIn(BaseModel):
    title: str
    deadline: str | None = None


def _check_deadline(deadline: str | None) -> None:
    if deadline and not re.match(r"^\d{4}-\d{2}-\d{2}$", deadline):
        raise HTTPException(status_code=400, detail="deadline must be YYYY-MM-DD")


@router.get("/goals")
def api_goals(archive: bool = False, user: dict = Depends(get_current_user)):
    return get_goals(user["id"], archive)


@router.post("/goals")
def api_create_goal(body: GoalIn, user: dict = Depends(get_current_user)):
    _check_deadline(body.deadline)
    return add_goal(user["id"], body.title, body.deadline)


@router.post("/goals/{goal_id}/complete")
def api_complete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    done = complete_goal(goal_id, uid)
    if done:
        add_xp(uid, "discipline", 10, "goals")
        add_xp(uid, "reflection", 5, "goals")
    return {"done": done, "xp_granted": {"stat": "discipline", "amount": 10} if done else None}


@router.patch("/goals/{goal_id}")
def api_update_goal(goal_id: str, body: GoalIn, user: dict = Depends(get_current_user)):
    _check_deadline(body.deadline)
    ok = update_goal(goal_id, user["id"], body.title, body.deadline)
    if not ok:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"ok": True}


@router.delete("/goals/{goal_id}")
def api_delete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    ok = delete_goal(goal_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"ok": True}


# --- Đ†Đ´ĐµŃ— ----------------------------------------------------------------------


class IdeaIn(BaseModel):
    text: str


@router.get("/ideas")
def api_ideas(user: dict = Depends(get_current_user)):
    return get_ideas(user["id"])


@router.post("/ideas")
def api_create_idea(body: IdeaIn, user: dict = Depends(get_current_user)):
    return add_idea(user["id"], body.text)


@router.patch("/ideas/{idea_id}")
def api_update_idea(idea_id: str, body: IdeaIn, user: dict = Depends(get_current_user)):
    ok = update_idea(idea_id, user["id"], body.text)
    if not ok:
        raise HTTPException(status_code=404, detail="Idea not found")
    return {"ok": True}


@router.delete("/ideas/{idea_id}")
def api_delete_idea(idea_id: str, user: dict = Depends(get_current_user)):
    ok = delete_idea(idea_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Idea not found")
    return {"ok": True}


# --- Đ—ŃŃŃ‚Ń€Ń–Ń‡Ń– -------------------------------------------------------------------


class MeetingIn(BaseModel):
    title: str
    date: str
    time: str | None = None


def _check_meeting_date(d: str) -> None:
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")


@router.get("/meetings")
def api_meetings(user: dict = Depends(get_current_user)):
    return get_upcoming_meetings(user["id"])


@router.post("/meetings")
def api_create_meeting(body: MeetingIn, user: dict = Depends(get_current_user)):
    _check_meeting_date(body.date)
    return add_meeting(user["id"], body.title, body.date, body.time)


@router.patch("/meetings/{meeting_id}")
def api_update_meeting(meeting_id: str, body: MeetingIn, user: dict = Depends(get_current_user)):
    _check_meeting_date(body.date)
    ok = update_meeting(meeting_id, user["id"], body.title, body.date, body.time)
    if not ok:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"ok": True}


@router.delete("/meetings/{meeting_id}")
def api_delete_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    ok = delete_meeting(meeting_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"ok": True}
```

- [x] **Step 7: Verify syntax**

Run: `python -m py_compile backend/db.py backend/api_routes.py backend/main.py`
Expected: no output.

- [x] **Step 8: Commit + push**

```bash
git add backend/db.py backend/api_routes.py
git commit -m "feat: REST endpoints for goals, ideas, meetings (GET/POST/PATCH/DELETE, goal complete with XP)"
git push
```

---

### Task 2: api.ts â€” types + methods

**Files:**
- Modify: `miniapp/src/api.ts`

**Interfaces:**
- Produces: `Goal {id,title,deadline,is_done,done_at?}`, `Idea {id,text,created_at}`, `Meeting {id,title,date,time}`; methods `goals`, `archivedGoals`, `addGoal`, `completeGoal`, `updateGoal`, `deleteGoal`, `ideas`, `addIdea`, `updateIdea`, `deleteIdea`, `meetings`, `addMeeting`, `updateMeeting`, `deleteMeeting`. (`digest`/`DigestData` already exist.)

- [x] **Step 1: Add methods inside the `api` object (before the closing `}`)**

```typescript
  goals: (initData: string) => req<Goal[]>('/api/goals', initData),
  archivedGoals: (initData: string) => req<Goal[]>('/api/goals?archive=true', initData),
  addGoal: (initData: string, title: string, deadline?: string) =>
    req<Goal>('/api/goals', initData, {
      method: 'POST',
      body: JSON.stringify({ title, deadline: deadline || null }),
    }),
  completeGoal: (initData: string, id: string) =>
    req<{ done: boolean; xp_granted: XpGranted }>(`/api/goals/${id}/complete`, initData, { method: 'POST' }),
  updateGoal: (initData: string, id: string, title: string, deadline?: string) =>
    req<{ ok: boolean }>(`/api/goals/${id}`, initData, {
      method: 'PATCH',
      body: JSON.stringify({ title, deadline: deadline || null }),
    }, true),
  deleteGoal: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/goals/${id}`, initData, { method: 'DELETE' }),
  ideas: (initData: string) => req<Idea[]>('/api/ideas', initData),
  addIdea: (initData: string, text: string) =>
    req<Idea>('/api/ideas', initData, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  updateIdea: (initData: string, id: string, text: string) =>
    req<{ ok: boolean }>(`/api/ideas/${id}`, initData, {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    }, true),
  deleteIdea: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/ideas/${id}`, initData, { method: 'DELETE' }),
  meetings: (initData: string) => req<Meeting[]>('/api/meetings', initData),
  addMeeting: (initData: string, title: string, date: string, time?: string) =>
    req<Meeting>('/api/meetings', initData, {
      method: 'POST',
      body: JSON.stringify({ title, date, time: time || null }),
    }),
  updateMeeting: (initData: string, id: string, title: string, date: string, time?: string) =>
    req<{ ok: boolean }>(`/api/meetings/${id}`, initData, {
      method: 'PATCH',
      body: JSON.stringify({ title, date, time: time || null }),
    }, true),
  deleteMeeting: (initData: string, id: string) =>
    req<{ ok: boolean }>(`/api/meetings/${id}`, initData, { method: 'DELETE' }),
```

- [x] **Step 2: Add interfaces near the other entity types**

```typescript
export interface Goal {
  id: string
  title: string
  deadline: string | null
  is_done: boolean
  done_at?: string | null
}

export interface Idea {
  id: string
  text: string
  created_at: string
}

export interface Meeting {
  id: string
  title: string
  date: string
  time: string | null
}
```

- [x] **Step 3: Verify build**

Run: `cd miniapp && npm run build`
Expected: builds without errors.

- [x] **Step 4: Commit + push**

```bash
git add miniapp/src/api.ts
git commit -m "feat: api client for goals, ideas, meetings"
git push
```

---

### Task 3: Goals page + unlock in NavGrid

**Files:**
- Create: `miniapp/src/pages/Goals.tsx`
- Modify: `miniapp/src/App.tsx` (import, View union, switch case)
- Modify: `miniapp/src/components/NavGrid.tsx` (goals â†’ `locked: false`)

**Interfaces:**
- Consumes: `api.goals/archivedGoals/addGoal/completeGoal/updateGoal/deleteGoal`, `Goal` type, `SwipeRow`, `BottomSheet`, `TextField`, `useToast`, `xpToastText`, `haptic`
- Produces: `<Goals initData onDataChange />` page

- [x] **Step 1: Create `miniapp/src/pages/Goals.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Goal } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { useToast } from '../components/Toast'
import { xpToastText, haptic } from '../utils'

type Tab = 'active' | 'archive'

export function Goals({ initData, onDataChange }: { initData: string; onDataChange?: () => void }) {
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('active')
  const [goals, setGoals] = useState<Goal[]>([])
  const [archived, setArchived] = useState<Goal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<Goal | null>(null)
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.goals(initData)
      .then(d => { setGoals(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  async function loadArchive() {
    if (archived !== null) return
    setArchiveLoading(true)
    try {
      setArchived(await api.archivedGoals(initData))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    } finally {
      setArchiveLoading(false)
    }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setOpenId(null)
    setActionErr('')
    if (t === 'archive') loadArchive()
  }

  async function complete(id: string) {
    setCompleting(id)
    setActionErr('')
    try {
      const res = await api.completeGoal(initData, id)
      if (res.done) {
        haptic('success')
        if (res.xp_granted) push(xpToastText(res.xp_granted))
        const done = goals.find(g => g.id === id)
        setGoals(prev => prev.filter(g => g.id !== id))
        if (done) setArchived(prev => prev ? [{ ...done, is_done: true }, ...prev] : null)
        onDataChange?.()
      }
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    } finally {
      setCompleting(null)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteGoal(initData, id)
      setGoals(prev => prev.filter(g => g.id !== id))
      setArchived(prev => prev ? prev.filter(g => g.id !== id) : null)
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    }
  }

  function openAdd() {
    haptic('light')
    setEditItem(null)
    setTitle('')
    setDeadline('')
    setAddOpen(true)
  }

  function startEdit(g: Goal) {
    setOpenId(null)
    setEditItem(g)
    setTitle(g.title)
    setDeadline(g.deadline ?? '')
    setAddOpen(true)
  }

  function closeSheet() {
    setAddOpen(false)
    setEditItem(null)
    setTitle('')
    setDeadline('')
  }

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    setActionErr('')
    try {
      if (editItem) {
        await api.updateGoal(initData, editItem.id, title.trim(), deadline || undefined)
        setGoals(prev => prev.map(g => g.id === editItem.id ? { ...g, title: title.trim(), deadline: deadline || null } : g))
      } else {
        const g = await api.addGoal(initData, title.trim(), deadline || undefined)
        setGoals(prev => [...prev, g])
      }
      closeSheet()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>â€¦</div>
  if (err) return <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>

  const todayIso = new Date().toISOString().slice(0, 10)
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
            {t === 'active' ? `ĐĐšĐ˘ĐĐ’ĐťĐ† ${goals.length > 0 ? goals.length : ''}` : 'ĐĐ ĐĄĐ†Đ’'}
          </button>
        ))}
      </div>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {tab === 'active' && (
        <>
          <button
            onClick={openAdd}
            className="w-full px-4 py-3 font-mono text-xs text-left"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', minHeight: '44px' }}
          >
            + ĐťĐžĐ’Đ Đ¦Đ†Đ›Đ¬
          </button>

          {goals.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Đ¦Ń–Đ»ĐµĐą Đ˝ĐµĐĽĐ°Ń”.<br />Đ”ĐľĐ´Đ°Đą ĐşĐ˝ĐľĐżĐşĐľŃŽ Đ˛Đ¸Ń‰Đµ Đ°Đ±Đľ Ń‡ĐµŃ€ĐµĐ· Đ±ĐľŃ‚: /addgoal ĐťĐ°Đ·Đ˛Đ°
            </div>
          )}

          {goals.map(g => {
            const overdue = g.deadline != null && g.deadline < todayIso
            return (
              <SwipeRow
                key={g.id}
                id={g.id}
                openId={openId}
                onOpen={setOpenId}
                onClose={() => setOpenId(null)}
                actions={[
                  { label: 'Đ ĐµĐ´Đ°Đł.', bgColor: '#374151', onClick: () => startEdit(g) },
                  { label: 'Đ’Đ¸Đ´Đ°Đ»Đ¸Ń‚Đ¸', bgColor: '#dc2626', onClick: () => handleDelete(g.id) },
                ]}
                style={{ borderBottom: '1px solid var(--subtle)' }}
              >
                <div className="flex items-center justify-between px-4 py-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-condensed text-sm line-clamp-2">{g.title}</div>
                    {g.deadline && (
                      <div className="font-mono text-xs mt-1" style={{ color: overdue ? '#dc2626' : 'var(--muted)' }}>
                        Đ”Đž {g.deadline}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => complete(g.id)}
                    disabled={completing === g.id}
                    className="press-invert font-mono text-xs px-4 flex-shrink-0"
                    style={{
                      minHeight: '44px',
                      border: '1px solid var(--ink)',
                      background: 'transparent',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      opacity: completing === g.id ? 0.4 : 1,
                    }}
                  >
                    Đ“ĐľŃ‚ĐľĐ˛Đľ
                  </button>
                </div>
              </SwipeRow>
            )
          })}
        </>
      )}

      {tab === 'archive' && (
        <>
          {archiveLoading && <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>â€¦</div>}
          {archived !== null && archived.length === 0 && (
            <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
              Đ’Đ¸ĐşĐľĐ˝Đ°Đ˝Đ¸Ń… Ń†Ń–Đ»ĐµĐą Đ˝ĐµĐĽĐ°Ń”.
            </div>
          )}
          {archived?.map(g => (
            <SwipeRow
              key={g.id}
              id={g.id}
              openId={openId}
              onOpen={setOpenId}
              onClose={() => setOpenId(null)}
              actions={[
                { label: 'Đ’Đ¸Đ´Đ°Đ»Đ¸Ń‚Đ¸', bgColor: '#dc2626', onClick: () => handleDelete(g.id) },
              ]}
              style={{ borderBottom: '1px solid var(--subtle)' }}
            >
              <div className="flex items-center justify-between px-4 py-4 gap-3">
                <span className="font-condensed text-sm flex-1 line-clamp-2" style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>
                  {g.title}
                </span>
                {g.done_at && (
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                    {formatDate(g.done_at)}
                  </span>
                )}
              </div>
            </SwipeRow>
          ))}
        </>
      )}

      {/* Add/Edit BottomSheet */}
      <BottomSheet open={addOpen} onClose={closeSheet}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">
            {editItem ? 'Đ ĐµĐ´Đ°ĐłŃĐ˛Đ°Ń‚Đ¸ Ń†Ń–Đ»ŃŚ' : 'ĐťĐľĐ˛Đ° Ń†Ń–Đ»ŃŚ'}
          </div>
          <TextField
            autoFocus
            value={title}
            onChange={setTitle}
            onEnter={submit}
            placeholder="ĐťĐ°Đ·Đ˛Đ° Ń†Ń–Đ»Ń–..."
          />
          <TextField
            type="date"
            font="mono"
            border="subtle"
            value={deadline}
            onChange={setDeadline}
          />
          <button
            onClick={submit}
            disabled={saving || !title.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {editItem ? 'Đ—Đ±ĐµŃ€ĐµĐłŃ‚Đ¸' : 'Đ”ĐľĐ´Đ°Ń‚Đ¸'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [x] **Step 2: Wire into `App.tsx`**

Add import: `import { Goals } from './pages/Goals'`
Extend View union: `... | 'workouts' | 'goals'`
Add switch case: `case 'goals': return <Goals initData={initData} onDataChange={refreshProfile} />`

- [x] **Step 3: Unlock in `NavGrid.tsx`**

`{ id: 'goals', num: '08', label: 'Đ¦Ń–Đ»Ń–', locked: false, color: 'var(--ink)' },`

- [x] **Step 4: Verify build**

Run: `cd miniapp && npm run build`
Expected: builds without errors.

- [x] **Step 5: Commit + push**

```bash
git add miniapp/src/pages/Goals.tsx miniapp/src/App.tsx miniapp/src/components/NavGrid.tsx
git commit -m "feat: Goals page in Mini App â€” active/archive tabs, complete with XP, CRUD"
git push
```

---

### Task 4: Ideas page + unlock

**Files:**
- Create: `miniapp/src/pages/Ideas.tsx`
- Modify: `miniapp/src/App.tsx`
- Modify: `miniapp/src/components/NavGrid.tsx` (ideas â†’ `locked: false`)

**Interfaces:**
- Consumes: `api.ideas/addIdea/updateIdea/deleteIdea`, `Idea` type
- Produces: `<Ideas initData />` page

- [x] **Step 1: Create `miniapp/src/pages/Ideas.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Idea } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { haptic } from '../utils'

export function Ideas({ initData }: { initData: string }) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<Idea | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.ideas(initData)
      .then(d => { setIdeas(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function openAdd() {
    haptic('light')
    setEditItem(null)
    setText('')
    setSheetOpen(true)
  }

  function startEdit(i: Idea) {
    setOpenId(null)
    setEditItem(i)
    setText(i.text)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditItem(null)
    setText('')
  }

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    setActionErr('')
    try {
      if (editItem) {
        await api.updateIdea(initData, editItem.id, text.trim())
        setIdeas(prev => prev.map(i => i.id === editItem.id ? { ...i, text: text.trim() } : i))
      } else {
        const idea = await api.addIdea(initData, text.trim())
        setIdeas(prev => [idea, ...prev])
      }
      closeSheet()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteIdea(initData, id)
      setIdeas(prev => prev.filter(i => i.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>â€¦</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>Đ†Đ”Đ•Đ‡</span>
        <span>{ideas.length}</span>
      </div>

      <button
        onClick={openAdd}
        className="w-full px-4 py-3 font-mono text-xs text-left"
        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', minHeight: '44px' }}
      >
        + ĐťĐžĐ’Đ Đ†Đ”Đ•ĐŻ
      </button>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {ideas.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Đ†Đ´ĐµĐą Đ˝ĐµĐĽĐ°Ń”.<br />Đ”ĐľĐ´Đ°Đą ĐşĐ˝ĐľĐżĐşĐľŃŽ Đ˛Đ¸Ń‰Đµ Đ°Đ±Đľ Ń‡ĐµŃ€ĐµĐ· Đ±ĐľŃ‚: /idea Đ˘ĐµĐşŃŃ‚
        </div>
      )}

      {ideas.map(i => (
        <SwipeRow
          key={i.id}
          id={i.id}
          openId={openId}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
          actions={[
            { label: 'Đ ĐµĐ´Đ°Đł.', bgColor: '#374151', onClick: () => startEdit(i) },
            { label: 'Đ’Đ¸Đ´Đ°Đ»Đ¸Ń‚Đ¸', bgColor: '#dc2626', onClick: () => handleDelete(i.id) },
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

      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">
            {editItem ? 'Đ ĐµĐ´Đ°ĐłŃĐ˛Đ°Ń‚Đ¸ Ń–Đ´ĐµŃŽ' : 'ĐťĐľĐ˛Đ° Ń–Đ´ĐµŃŹ'}
          </div>
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Đ—Đ°ĐżĐ¸ŃĐ¸ Ń–Đ´ĐµŃŽ..."
            rows={3}
            className="w-full px-3 py-3 font-condensed text-sm outline-none resize-none"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}
          />
          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {editItem ? 'Đ—Đ±ĐµŃ€ĐµĐłŃ‚Đ¸' : 'Đ”ĐľĐ´Đ°Ń‚Đ¸'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [x] **Step 2: Wire into `App.tsx`**

Import `Ideas`, extend View union with `'ideas'`, add `case 'ideas': return <Ideas initData={initData} />`.

- [x] **Step 3: Unlock `ideas` in NavGrid (`locked: false`).**

- [x] **Step 4: Verify build** â€” `cd miniapp && npm run build`, no errors.

- [x] **Step 5: Commit + push**

```bash
git add miniapp/src/pages/Ideas.tsx miniapp/src/App.tsx miniapp/src/components/NavGrid.tsx
git commit -m "feat: Ideas page in Mini App â€” list, add, edit, delete"
git push
```

---

### Task 5: Meetings page + unlock

**Files:**
- Create: `miniapp/src/pages/Meetings.tsx`
- Modify: `miniapp/src/App.tsx`
- Modify: `miniapp/src/components/NavGrid.tsx` (meet â†’ `locked: false`)

**Interfaces:**
- Consumes: `api.meetings/addMeeting/updateMeeting/deleteMeeting`, `Meeting` type
- Produces: `<Meetings initData />` page

- [x] **Step 1: Create `miniapp/src/pages/Meetings.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Meeting } from '../api'
import { SwipeRow } from '../components/SwipeRow'
import { BottomSheet } from '../components/BottomSheet'
import { TextField } from '../components/TextField'
import { haptic } from '../utils'

function sortMeetings(list: Meeting[]): Meeting[] {
  return [...list].sort((a, b) =>
    a.date === b.date ? (a.time ?? '99:99').localeCompare(b.time ?? '99:99') : a.date.localeCompare(b.date))
}

export function Meetings({ initData }: { initData: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<Meeting | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.meetings(initData)
      .then(d => { setMeetings(sortMeetings(d)); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [initData])

  function openAdd() {
    haptic('light')
    setEditItem(null)
    setTitle('')
    setDate('')
    setTime('')
    setSheetOpen(true)
  }

  function startEdit(m: Meeting) {
    setOpenId(null)
    setEditItem(m)
    setTitle(m.title)
    setDate(m.date)
    setTime(m.time ? m.time.slice(0, 5) : '')
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditItem(null)
    setTitle('')
    setDate('')
    setTime('')
  }

  async function submit() {
    if (!title.trim() || !date) return
    setSaving(true)
    setActionErr('')
    try {
      if (editItem) {
        await api.updateMeeting(initData, editItem.id, title.trim(), date, time || undefined)
        setMeetings(prev => sortMeetings(prev.map(m =>
          m.id === editItem.id ? { ...m, title: title.trim(), date, time: time || null } : m)))
      } else {
        const m = await api.addMeeting(initData, title.trim(), date, time || undefined)
        setMeetings(prev => sortMeetings([...prev, m]))
      }
      closeSheet()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setOpenId(null)
    setActionErr('')
    try {
      await api.deleteMeeting(initData, id)
      setMeetings(prev => prev.filter(m => m.id !== id))
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'ĐźĐľĐĽĐ¸Đ»ĐşĐ°')
    }
  }

  if (loading) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>â€¦</div>
  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>

  const todayIso = new Date().toISOString().slice(0, 10)
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const dateLabel = (d: string) => {
    if (d === todayIso) return 'ĐˇĐ¬ĐžĐ“ĐžĐ”ĐťĐ†'
    if (d === tomorrowIso) return 'Đ—ĐĐ’Đ˘Đ Đ'
    return new Date(`${d}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }).toUpperCase()
  }

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs flex justify-between" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        <span>ĐťĐĐ™Đ‘Đ›ĐĐ–Đ§Đ† Đ—ĐŁĐˇĐ˘Đ Đ†Đ§Đ†</span>
        <span>{meetings.length}</span>
      </div>

      <button
        onClick={openAdd}
        className="w-full px-4 py-3 font-mono text-xs text-left"
        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--subtle)', color: 'var(--muted)', cursor: 'pointer', minHeight: '44px' }}
      >
        + ĐťĐžĐ’Đ Đ—ĐŁĐˇĐ˘Đ Đ†Đ§
      </button>

      {actionErr && <div className="px-4 py-2 text-xs" style={{ color: '#dc2626' }}>{actionErr}</div>}

      {meetings.length === 0 && (
        <div className="px-4 py-8 text-center font-condensed text-sm" style={{ color: 'var(--muted)' }}>
          Đ—ŃŃŃ‚Ń€Ń–Ń‡ĐµĐą Đ˝ĐµĐĽĐ°Ń”.<br />Đ”ĐľĐ´Đ°Đą ĐşĐ˝ĐľĐżĐşĐľŃŽ Đ˛Đ¸Ń‰Đµ Đ°Đ±Đľ Ń‡ĐµŃ€ĐµĐ· Đ±ĐľŃ‚: /addmeeting
        </div>
      )}

      {meetings.map(m => {
        const isToday = m.date === todayIso
        return (
          <SwipeRow
            key={m.id}
            id={m.id}
            openId={openId}
            onOpen={setOpenId}
            onClose={() => setOpenId(null)}
            actions={[
              { label: 'Đ ĐµĐ´Đ°Đł.', bgColor: '#374151', onClick: () => startEdit(m) },
              { label: 'Đ’Đ¸Đ´Đ°Đ»Đ¸Ń‚Đ¸', bgColor: '#dc2626', onClick: () => handleDelete(m.id) },
            ]}
            style={{ borderBottom: '1px solid var(--subtle)' }}
          >
            <div className="flex items-center justify-between px-4 py-4 gap-3">
              <span className="font-condensed text-sm flex-1 line-clamp-2">{m.title}</span>
              <span
                className="font-mono text-xs flex-shrink-0 text-right"
                style={{ color: isToday ? 'var(--ink)' : 'var(--muted)', fontWeight: isToday ? 600 : 400 }}
              >
                {dateLabel(m.date)}{m.time ? ` Â· ${m.time.slice(0, 5)}` : ''}
              </span>
            </div>
          </SwipeRow>
        )
      })}

      <BottomSheet open={sheetOpen} onClose={closeSheet}>
        <div className="p-6 space-y-4">
          <div className="font-condensed font-semibold text-base">
            {editItem ? 'Đ ĐµĐ´Đ°ĐłŃĐ˛Đ°Ń‚Đ¸ Đ·ŃŃŃ‚Ń€Ń–Ń‡' : 'ĐťĐľĐ˛Đ° Đ·ŃŃŃ‚Ń€Ń–Ń‡'}
          </div>
          <TextField
            autoFocus
            value={title}
            onChange={setTitle}
            placeholder="ĐťĐ°Đ·Đ˛Đ° Đ·ŃŃŃ‚Ń€Ń–Ń‡Ń–..."
          />
          <TextField type="date" font="mono" border="subtle" value={date} onChange={setDate} />
          <TextField type="time" font="mono" border="subtle" value={time} onChange={setTime} />
          <button
            onClick={submit}
            disabled={saving || !title.trim() || !date}
            className="w-full py-3 font-condensed font-semibold text-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none', cursor: 'pointer', opacity: saving || !title.trim() || !date ? 0.5 : 1 }}
          >
            {editItem ? 'Đ—Đ±ĐµŃ€ĐµĐłŃ‚Đ¸' : 'Đ”ĐľĐ´Đ°Ń‚Đ¸'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
```

- [x] **Step 2: Wire into `App.tsx`** â€” import `Meetings`, View union `'meet'`, `case 'meet': return <Meetings initData={initData} />`. (View id must be `meet` â€” it matches the NavGrid module id.)

- [x] **Step 3: Unlock `meet` in NavGrid (`locked: false`).**

- [x] **Step 4: Verify build** â€” `cd miniapp && npm run build`, no errors.

- [x] **Step 5: Commit + push**

```bash
git add miniapp/src/pages/Meetings.tsx miniapp/src/App.tsx miniapp/src/components/NavGrid.tsx
git commit -m "feat: Meetings page in Mini App â€” upcoming list, add, edit, delete"
git push
```

---

### Task 6: Digest page + unlock + hide Â«ĐˇĐšĐžĐ ĐžÂ»

**Files:**
- Create: `miniapp/src/pages/Digest.tsx`
- Modify: `miniapp/src/App.tsx`
- Modify: `miniapp/src/components/NavGrid.tsx` (digest â†’ `locked: false`; render Â«ĐˇĐšĐžĐ ĐžÂ» row only when locked modules exist)

**Interfaces:**
- Consumes: `api.digest`, `DigestData` (both already exist in api.ts)
- Produces: `<Digest initData />` page

- [x] **Step 1: Create `miniapp/src/pages/Digest.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DigestData } from '../api'

export function Digest({ initData }: { initData: string }) {
  const [data, setData] = useState<DigestData | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.digest(initData).then(setData).catch((e: Error) => setErr(e.message))
  }, [initData])

  if (err) return <div className="p-4 text-sm break-all" style={{ color: '#dc2626' }}>{err}</div>
  if (!data) return <div className="p-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>â€¦</div>

  const rows: { label: string; value: string }[] = [
    { label: 'Đ’ĐľĐ´Đ°', value: `${data.water_total} ĐĽĐ» Â· ${data.water_days} Đ´Đ˝` },
    { label: 'Đ Đ¸Ń‚ŃĐ°Đ»Đ¸', value: `${data.rituals_done}` },
    { label: 'Đ—Đ°Đ˛Đ´Đ°Đ˝Đ˝ŃŹ', value: `${data.tasks_done}` },
    { label: 'ĐšĐ°Đ»ĐľŃ€Ń–Ń—', value: `${data.kcal_avg} / Đ´ĐµĐ˝ŃŚ` },
    { label: 'ĐˇĐľĐ˝', value: `${data.sleep_avg_h.toFixed(1)} ĐłĐľĐ´ / Đ˝Ń–Ń‡` },
    { label: 'Đ˘Ń€ĐµĐ˝ŃĐ˛Đ°Đ˝Đ˝ŃŹ', value: `${data.workouts}` },
    { label: 'Đ’Đ¸Ń‚Ń€Đ°Ń‚Đ¸', value: `${data.spend_total} ĐłŃ€Đ˝` },
  ]

  return (
    <div style={{ color: 'var(--ink)' }}>
      <div className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--subtle)' }}>
        Đ”ĐĐ™Đ”Đ–Đ•ĐˇĐ˘ â€” ĐžĐˇĐ˘ĐĐťĐťĐ† 7 Đ”ĐťĐ†Đ’
      </div>

      {rows.map(r => (
        <div
          key={r.label}
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid var(--subtle)' }}
        >
          <span className="font-condensed text-sm">{r.label}</span>
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.value}</span>
        </div>
      ))}

      <div className="flex items-center justify-between px-4 py-5" style={{ borderBottom: '1px solid var(--subtle)' }}>
        <span className="font-condensed font-semibold text-sm">XP Đ·Đ° Ń‚Đ¸Đ¶Đ´ĐµĐ˝ŃŚ</span>
        <span className="font-mono font-semibold text-sm" style={{ color: 'var(--accent)' }}>+{data.xp_earned}</span>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Wire into `App.tsx`** â€” import `Digest`, View union `'digest'`, `case 'digest': return <Digest initData={initData} />`.

- [x] **Step 3: NavGrid â€” unlock `digest`, hide empty Â«ĐˇĐšĐžĐ ĐžÂ» row**

Set `digest` â†’ `locked: false`. Then wrap the Â«ĐˇĐšĐžĐ ĐžÂ» div so it renders only when something is locked:

```tsx
      {LOCKED_LABELS.length > 0 && (
        <div
          className="font-mono px-4 py-2"
          style={{ fontSize: '10px', letterSpacing: '0.05em', color: 'var(--locked-text)', borderBottom: '1px solid var(--subtle)' }}
        >
          ĐˇĐšĐžĐ Đž: {LOCKED_LABELS.map(l => l.toUpperCase()).join(' Â· ')}
        </div>
      )}
```

- [x] **Step 4: Verify build** â€” `cd miniapp && npm run build`, no errors.

- [x] **Step 5: Commit + push**

```bash
git add miniapp/src/pages/Digest.tsx miniapp/src/App.tsx miniapp/src/components/NavGrid.tsx
git commit -m "feat: Digest page in Mini App â€” 7-day read-only summary; all NavGrid modules unlocked"
git push
```

---

### Task 7: Code review + docs update

**Files:**
- Modify: `docs/claude/current-state.md`
- Modify: `docs/claude/modules.md` (statuses of Đ¦Ń–Đ»Ń–/Đ†Đ´ĐµŃ—/Đ—ŃŃŃ‚Ń€Ń–Ń‡Ń–/Đ”Đ°ĐąĐ´Đ¶ĐµŃŃ‚ â€” add Mini App coverage)

- [x] **Step 1: Run code review** (superpowers:requesting-code-review / `/code-review`), fix findings, commit fixes.

- [x] **Step 2: Update `docs/claude/current-state.md`**

- Mini App row: 10 â†’ 14 screens; remove Â«Đ¦Ń–Đ»Ń–/Đ†Đ´ĐµŃ—/Đ—ŃŃŃ‚Ń€Ń–Ń‡Ń–/Đ”Đ°ĐąĐ´Đ¶ĐµŃŃ‚ â€” Ń‚ĐľĐ»ŃŚĐşĐľ Ń‡ĐµŃ€ĐµĐ· Đ±ĐľŃ‚Đ°Â»; note Â«ĐˇĐšĐžĐ ĐžÂ» line is gone.
- Add pages to the component list: `pages/Goals.tsx`, `pages/Ideas.tsx`, `pages/Meetings.tsx`, `pages/Digest.tsx` with one-line descriptions.
- Â«Đ§Ń‚Đľ ŃĐ»ĐµĐ´ŃŃŽŃ‰ĐµĐµ ĐżĐľ ĐżĐ»Đ°Đ˝ŃÂ»: mark modules done (02.07.2026), reference this plan/spec.

- [x] **Step 3: Update `docs/claude/modules.md`** â€” Mini App coverage for the 4 modules.

- [x] **Step 4: Commit + push**

```bash
git add docs/claude/current-state.md docs/claude/modules.md
git commit -m "docs: current-state â€” Mini App covers all bot modules (Goals, Ideas, Meetings, Digest)"
git push
```

---

## Post-Sprint Checklist

- [x] No migrations needed â€” verify `/api/goals`, `/api/ideas`, `/api/meetings` respond after Render deploy.
- [x] Smoke test in Telegram: NavGrid has no Â«ĐˇĐšĐžĐ ĐžÂ» line; Đ¦Ń–Đ»Ń– add/complete (toast `+10 XP â†’ Đ”ĐĐˇĐ¦ĐĐźĐ›Đ†ĐťĐ`)/edit/delete + archive; Đ†Đ´ĐµŃ— add/edit/delete; Đ—ŃŃŃ‚Ń€Ń–Ń‡Ń– add (Â«ĐˇĐ¬ĐžĐ“ĐžĐ”ĐťĐ†Â» highlight)/edit/delete; Đ”Đ°ĐąĐ´Đ¶ĐµŃŃ‚ shows 7-day numbers.
