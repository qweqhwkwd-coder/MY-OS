# Mini App — последние 4 модуля: Цілі, Ідеї, Зустрічі, Дайджест

**Дата:** 2026-07-02
**Статус:** утверждено автором (вариант «Все 4 сразу», полный CRUD)

## Цель

Разблокировать последние закрытые блоки NavGrid — Цілі (08), Ідеї (10),
Зустрічі (11), Дайджест (12). После этого Mini App покрывает все модули,
доступные в боте, и строка «СКОРО: …» исчезает.

## Что уже есть (не делать заново)

- Таблицы `goals`, `ideas`, `meetings` существуют — **миграции не нужны**.
- `db.py`: `add_goal`, `get_goals`, `complete_goal`, `add_idea`, `get_ideas`,
  `add_meeting`, `get_upcoming_meetings`, `get_week_digest`.
- `GET /api/digest` уже существует; `api.digest()` и `DigestData` уже есть в `api.ts`.
- XP за выполнение цели (как в боте, `main.py` cb_goal): +10 discipline, +5 reflection, source `goals`.

## Бэкенд

### db.py — новые/изменённые функции

- `get_goals(user_id, archive: bool = False)` — расширить: `archive=True` → `is_done=True`,
  сортировка по `done_at desc`; активные — как сейчас. Селектить также `done_at`.
- `update_goal(goal_id, user_id, title, deadline)` → bool
- `delete_goal(goal_id, user_id)` → bool
- `update_idea(idea_id, user_id, text)` → bool
- `delete_idea(idea_id, user_id)` → bool
- `get_ideas`: лимит 10 → 50
- `get_upcoming_meetings`: селектить `id,title,date,time` (сейчас без `id`), лимит 10 → 20
- `update_meeting(meeting_id, user_id, title, meeting_date, meeting_time)` → bool
- `delete_meeting(meeting_id, user_id)` → bool

Все update/delete — с фильтром `.eq("user_id", user_id)` (изоляция как в существующих delete_*).

### api_routes.py — новые эндпоинты

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/goals?archive=` | — | `[{id,title,deadline,is_done,done_at?}]` |
| POST | `/api/goals` | `{title, deadline?}` | goal |
| POST | `/api/goals/{id}/complete` | — | `{done: bool, xp_granted}` (+10 disc; тост по основному стату, XP начисляются оба: disc+refl) |
| PATCH | `/api/goals/{id}` | `{title, deadline?}` | `{ok}` |
| DELETE | `/api/goals/{id}` | — | `{ok}` |
| GET | `/api/ideas` | — | `[{id,text,status,created_at}]` |
| POST | `/api/ideas` | `{text}` | idea |
| PATCH | `/api/ideas/{id}` | `{text}` | `{ok}` |
| DELETE | `/api/ideas/{id}` | — | `{ok}` |
| GET | `/api/meetings` | — | `[{id,title,date,time}]` (предстоящие) |
| POST | `/api/meetings` | `{title, date, time?}` | meeting |
| PATCH | `/api/meetings/{id}` | `{title, date, time?}` | `{ok}` |
| DELETE | `/api/meetings/{id}` | — | `{ok}` |

`xp_granted` в ответе complete: `{stat: "discipline", amount: 10}` — как у задач;
второе начисление (+5 reflection) происходит на сервере, в тосте не показывается
(формат тостов одностатный, как везде).

## Фронтенд (стиль «Паперова ОС»: mono-шапки, SwipeRow, BottomSheet, haptic, тосты XP)

### api.ts

Типы `Goal {id,title,deadline,is_done,done_at?}`, `Idea {id,text,created_at}`,
`Meeting {id,title,date,time}`. Методы: `goals`, `archivedGoals`, `addGoal`,
`completeGoal`, `updateGoal`, `deleteGoal`, `ideas`, `addIdea`, `updateIdea`,
`deleteIdea`, `meetings`, `addMeeting`, `updateMeeting`, `deleteMeeting`.
PATCH — retryable (как `updateBodyProfile`), POST/DELETE — одна попытка.

### pages/Goals.tsx — по образцу Tasks.tsx

- Вкладки Активні/Архів (архив лениво).
- Строка: название + дедлайн mono (`ДО 2026-12-31`); просроченный — красным `#dc2626`.
- Кнопка «Готово» → `completeGoal` → тост XP → строка уходит из списка.
- SwipeRow: Редагувати (BottomSheet: TextField название + date-поле дедлайна, можно очистить) / Видалити.
- Форма добавления: BottomSheet по кнопке «+ Ціль» в шапке списка (название + опц. дедлайн).

### pages/Ideas.tsx — по образцу Notes.tsx

- Список: текст line-clamp-2 + дата mono.
- Форма добавления сверху (TextField + кнопка), как в Finance/Workouts.
- SwipeRow: Редагувати (BottomSheet textarea) / Видалити.

### pages/Meetings.tsx

- Список предстоящих по датам; дата+время mono; «СЬОГОДНІ» — акцент чернилами, «ЗАВТРА» — подпись.
- Форма добавления: название + `type=date` + опц. `type=time` (паттерн уже есть в Notes → «Зустріч»).
- SwipeRow: Редагувати / Видалити.

### pages/Digest.tsx — read-only

Строки за 7 дней из `DigestData`: ВОДА (`water_total` мл, `water_days` днів),
РИТУАЛИ, ЗАВДАННЯ, ККАЛ (середнє/день), СОН (сер. год), ТРЕНУВАННЯ,
ВИТРАТИ (грн), XP. Типографика: label font-condensed + значение font-mono,
разделители `--subtle`. Никаких форм.

### NavGrid.tsx / App.tsx

- `locked: false` у goals/ideas/meet/digest; цвет `var(--ink)`.
- Строку «СКОРО: …» рендерить только при наличии закрытых модулей (иначе скрыть).
- App.tsx: 4 новых view в роутинге; тосты XP от Goals через существующий паттерн
  (`onXp` / `xpToastText` — как у остальных страниц); HubStrip подхватит сам.

## Порядок реализации и коммиты

1. Бэкенд db.py + api_routes.py (все 3 модуля) + py_compile → коммит.
2. api.ts (типы+методы) → в составе первого фронт-коммита.
3. Goals.tsx + роутинг → build → коммит.
4. Ideas.tsx → build → коммит.
5. Meetings.tsx → build → коммит.
6. Digest.tsx + NavGrid unlock + скрытие «СКОРО» → build → коммит.
7. Код-ревью, обновление `docs/claude/current-state.md` (+`modules.md`) → коммит. Пуш.

## Вне скоупа

- Конвертация идеи → задача (есть из Нотаток).
- Прошедшие встречи (показываем только предстоящие — паритет с ботом).
- AI-выводы в дайджесте (Фаза 4).
