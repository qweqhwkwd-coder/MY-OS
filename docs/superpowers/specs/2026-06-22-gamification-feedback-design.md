# Слой обратной связи XP/HP (тосты + майлстоуны + график роста) — Спек

**Дата:** 2026-06-22
**Статус:** Подтверждено пользователем
**Контекст:** Текущая RPG-система (`docs/claude/rpg-system.md`) только плюсует XP без единого
момента обратной связи — нет детекта level-up, нет майлстоунов, нет визуализации роста
во времени (`stats_history` так и не сделан). Пользователь хочет «видно прогресс,
завязано на дофамине». Из трёх предложенных направлений выбраны **A** (моменты
обратной связи) **+ C** (видимость роста), **B** (бонусы/штрафы баланса) — осознанно
отложено на отдельное обсуждение.

Попутно при аудите паритета XP между ботом и Mini App найден и пофикшен реальный баг
(коммит `7a08f27`): `POST /api/food` не начислял XP вообще, хотя бот начисляет +2
Харчування. Это не часть этого спека, упомянуто для контекста.

---

## 0. Архитектура — два независимых источника тостов

Один UI-компонент тостов, два разных триггера:

1. **За конкретное действие** — эндпоинт точно знает, начислил ли он XP именно сейчас,
   и должен явно вернуть это фронту, а не глушить как сейчас.
2. **Левел-апи/майлстоуны/ранг** — без новых таблиц. Фронт хранит предыдущий снимок
   `/api/profile`, после каждого обновления сравнивает level/rank/streak/per-stat-level/
   totals с предыдущим снимком — что пересекло порог, по тому и тост.

---

## 1. Фаза 1 — тост-компонент + тосты за конкретное действие

### 1.1 Backend — перестать глушить уже вычисленный xp_granted

Сейчас `db.add_water`/`db.toggle_ritual` уже возвращают, начислили ли XP, но
`api_routes.py` отбрасывает это значение (`_xp_eligible`). Меняем форму ответа везде,
где начисление условное или где сейчас вообще нет сигнала, на единый паттерн:

```python
xp_granted: dict | None  # {"stat": "health", "amount": 2} либо null, если не начислено
```

Конкретные изменения `backend/api_routes.py`:

```python
@router.post("/water")
def api_add_water(body: WaterIn, user: dict = Depends(get_current_user)):
    if body.amount not in (250, 500, 1000):
        raise HTTPException(status_code=400, detail="amount must be 250, 500 or 1000")
    uid = user["id"]
    goal = user.get("water_goal") or DEFAULT_WATER_GOAL
    total, xp_granted = add_water(uid, body.amount, goal)
    return {"total": total, "xp_granted": {"stat": "health", "amount": 2} if xp_granted else None}


@router.post("/rituals/{ritual_id}/toggle")
def api_toggle_ritual(ritual_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    now_done, xp_eligible = toggle_ritual(ritual_id, uid)
    return {"done": now_done, "xp_granted": {"stat": "discipline", "amount": 2} if xp_eligible else None}


@router.post("/tasks/{task_id}/complete")
def api_complete_task(task_id: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    done = complete_task(task_id, uid)
    return {"done": done, "xp_granted": {"stat": "discipline", "amount": 3} if done else None}


@router.post("/food")
def api_add_food_entry(body: FoodIn, user: dict = Depends(get_current_user)):
    entry = add_food(user["id"], body.food_name, body.kcal, body.grams)
    add_xp(user["id"], "nutrition", 2, "food")
    return {**entry, "xp_granted": {"stat": "nutrition", "amount": 2}}


@router.post("/diary")
def api_add_diary_entry(body: DiaryIn, user: dict = Depends(get_current_user)):
    entry = add_diary_entry(user["id"], body.text, body.mood)
    add_xp(user["id"], "reflection", 2, "journal")
    return {**entry, "xp_granted": {"stat": "reflection", "amount": 2}}
```

`POST /api/food` уже получил `add_xp` в коммите `7a08f27` этой сессии — здесь только
добавляется поле `xp_granted` в ответ, начисление само не меняется.

Действия, которые НЕ начисляют XP (создание ритуала, нотатка/inbox, rename/delete) —
поле `xp_granted` просто не добавляется в их ответы, фронт трактует отсутствие ключа
как «нет тоста».

### 1.2 Frontend — компонент тостов

Новый `miniapp/src/components/Toast.tsx` + контекст-провайдер (первый React Context
в проекте — обоснован тем, что тост должен быть вызываем из любой страницы без
прокидывания пропсов через `App.tsx`; не требует новых npm-зависимостей, обычный
`createContext`/`useContext`):

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  text: string
  size: 'sm' | 'lg'
}

interface ToastContextValue {
  push: (text: string, size?: 'sm' | 'lg') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const push = useCallback((text: string, size: 'sm' | 'lg' = 'sm') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, text, size }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, size === 'lg' ? 4000 : 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 pt-3 px-4 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`font-mono text-center px-4 py-2 ${t.size === 'lg' ? 'text-base font-semibold' : 'text-xs'}`}
            style={{ background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

Визуально: верх экрана (не низ — там уже модалки/bottom sheet, путаница со смыслом),
монохромный фон `var(--bg)` с рамкой/текстом в `var(--accent)` (индиго уже зарезервирован
под XP/RPG по дизайн-памяти проекта), без анимации конфетти/полноэкранных твистов —
именно "увеличенный тост" для `lg`, не отдельный экран, чтобы не сломать спокойный
editorial-стиль приложения.

`App.tsx` оборачивает корень в `<ToastProvider>`.

### 1.3 Frontend — вызовы из страниц

Везде, где код уже делает `await api.xxx(...)`, после успеха проверяем
`response.xp_granted` и зовём `push`:

```tsx
const { push } = useToast()
...
const res = await api.addWater(initData, amount)
if (res.xp_granted) push(`+${res.xp_granted.amount} XP до ${STAT_LABEL[res.xp_granted.stat]}`)
```

Нужна общая мапа `stat → укр. подпись` на фронте (сейчас такая есть только в боте,
`main.py: STAT_LABELS`) — продублировать в `miniapp/src/utils.ts`, как уже задокументирован
паттерн дублирования констант бот/Mini App в спеке Diary.

Затрагиваемые файлы: `Today.tsx` (вода, їжа — внутри quick-add), `Water.tsx`,
`Rituals.tsx` (toggle), `Tasks.tsx` (заменяет текущий ad-hoc `successMsg` на единый
тост — `completeErr`-текст для "вже виконано" остаётся как есть, это не XP-тост),
`Diary.tsx`.

`api.ts` — типы `WaterIn`/`Ritual`/`Task`/`DiaryEntry`-связанные функции получают
`xp_granted?: {stat: string; amount: number} | null` в возвращаемых интерфейсах.

---

## 2. Фаза 2 — майлстоуны через диффинг профиля

### 2.1 Backend — totals в `/api/profile`

`backend/db.py`, новая функция:

```python
def get_completion_totals(user_id: str) -> dict:
    tasks_done = (
        supabase.table("tasks").select("id", count="exact")
        .eq("user_id", user_id).eq("is_completed", True).execute().count
    )
    rituals_done = (
        supabase.table("ritual_logs").select("id", count="exact")
        .eq("user_id", user_id).eq("is_done", True).execute().count
    )
    return {"tasks_done": tasks_done or 0, "rituals_done": rituals_done or 0}
```

`api_routes.py: api_profile` добавляет `get_completion_totals(uid)` в существующий
`parallel(...)` вызов (та же оптимизация из P1 этой сессии), результат кладётся в
ответ как `"totals": {...}`.

### 2.2 Frontend — диффинг

В `App.tsx`, рядом с `refreshProfile`, держим `prevProfileRef` (предыдущий снимок перед
перезаписью state) и после каждого успешного фетча сравниваем:

| Поле | Порог пересечения | Текст тоста |
|---|---|---|
| `level` | любое увеличение | `🎉 Рівень {level}!` (lg) |
| `rank` | строка изменилась | `🏆 Новий ранг: {rank}!` (lg) |
| `streak` | пересекло 7/30/100 | `🔥 Стрік {N} днів!` (lg) |
| `stats[key]` (через `//100`) | пересекло кратное 5 | `{label} lvl {N}!` (sm) |
| `totals.tasks_done` / `totals.rituals_done` | пересекло 10/50/100 | `✅ {N} задач виконано!` (lg) |

Все пороги проверяются как `prev < threshold <= next`, не `next === threshold` — защита
от пропуска порога при батче из нескольких начислений за один профильный фетч.

Эта диффинг-логика — чистая функция (вход: два объекта `ProfileData`, выход: список
строк для `push`), без сетевых вызовов, легко тестируется отдельно.

---

## 3. Фаза 3 — график роста (`xp_events`, без новой таблицы)

### 3.1 Backend

```python
def get_xp_history(user_id: str, days: int = 30) -> list[dict]:
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    rows = (
        supabase.table("xp_events").select("xp_amount,created_at")
        .eq("user_id", user_id).gte("created_at", start).execute().data
    )
    by_day: dict[str, int] = {}
    for r in rows:
        day = r["created_at"][:10]
        by_day[day] = by_day.get(day, 0) + r["xp_amount"]
    return [
        {"date": d, "xp": by_day.get(d, 0)}
        for d in (
            (date.today() - timedelta(days=i)).isoformat()
            for i in range(days - 1, -1, -1)
        )
    ]
```

`GET /api/xp-history?days=30` в `api_routes.py`, оборачивает вызов выше.

v1 — одна линия (суммарный XP по дням за 30 дней), не разбивка по 8 статам отдельно —
именно это буквально просил пользователь («видно прогресс роста»). Разбивка по
статам / радарная диаграмма — возможное будущее расширение, не в этом спеке.

### 3.2 Frontend

Новая зависимость `recharts` (была заложена в продуктовом доке как целевая, ещё не
внедрена). Новая секция в `ProfileModal.tsx`, простой `<LineChart>` — один accent-цвет,
минимум сетки/подписей, в стиле остального профиля.

---

## 4. Явно вне скоупа

- Approach B (бонусы за стрик, штрафы за просрочку) — отдельное обсуждение, риск
  демотивации при неудачной балансировке.
- XP за разбор Inbox (inbox→task/diary/idea/meeting) — найдено при аудите, что сейчас
  не начисляется ни там, ни в боте-эквиваленте (которого для этого флоу не существует) —
  осознанное решение нужно отдельно, не часть этого спека.
- Звук/haptic-фидбек (Telegram WebApp `HapticFeedback` API не используется в проекте
  сейчас) — возможное дешёвое доп. усиление тостов, не в этом спеке.
- Тосты на стороне бота — у бота уже есть свой эквивалент через `callback.answer()`/
  текст сообщений, этот спек про Mini App.
- Радарная диаграма / разбивка графика по 8 статам отдельно.

---

## 5. Тестирование

Без автотестов (принятая конвенция проекта). По каждой фазе:
- `python -m py_compile backend/*.py`
- Ручной smoke-тест новых/изменённых эндпоинтов через venv против реальной Supabase
  (тот же подход, что для P1/P2/Diary в этой сессии)
- Диффинг-функцию майлстоунов (фаза 2) — можно покрыть отдельным скриптом без
  фреймворка: набор пар `(prevProfile, nextProfile)` → ожидаемый список тостов
- `tsc -b && vite build`, `npm run lint` для фронтенда после каждой фазы
- Код-ревью субагентом после каждой фазы (не одним разом по всем трём)
