# Mini App — экран «Дневник» (minimal v1) — Спек

**Дата:** 2026-06-22
**Статус:** Подтверждено пользователем
**Контекст:** Следующий шаг доращивания Mini App до паритета с ботом (после Notes/Inbox). Тайл `diary` уже зарезервирован в `NavGrid.tsx` (`locked: true`).

---

## 0. Проблема

В боте `/journal` поддерживает: добавление записи (текст + опциональное настроение 1-5), просмотр последних 10 записей, архив по конкретной дате. Редактирования и удаления записей нет — ни в боте, ни где-либо ещё.

В Mini App экрана дневника нет вообще, хотя backend (`db.py`: `get_diary_entries`, `get_diary_entries_by_date`, `add_diary_entry`) уже всё умеет.

**Решение по скоупу:** делаем minimal-версию сейчас — список последних записей + добавление. Архив по дате и любое редактирование/удаление — осознанно отдельными шагами позже (как было с Tasks: сначала add/complete, rename/delete — отдельным следующим коммитом). Бандлить всё сразу пользователь отклонил — слишком большая единица работы для одной итерации.

---

## 1. Backend

Новых функций в `db.py` не требуется — `get_diary_entries(user_id, limit=10)` и `add_diary_entry(user_id, text, mood=None)` уже существуют и используются ботом без изменений.

`backend/api_routes.py` — два новых роута:

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

`add_xp` нужно импортировать в `api_routes.py` (сейчас не импортирован там — есть только в `main.py`). XP/источник `"journal"` и стат `"reflection"` — те же, что в боте (`main.py: cmd_journal`).

---

## 2. Frontend

### Навигация

`NavGrid.tsx`: тайл `{ id: 'diary', num: '09', label: 'Щоденник', locked: true }` → `locked: false`. Текст тайла не меняется, он уже на месте.

`App.tsx`: добавить `'diary'` в union-тип `View`, импортировать `Diary`, добавить case в `switch`.

### `api.ts`

```typescript
diary: (initData: string) => req<DiaryEntry[]>('/api/diary', initData),
addDiaryEntry: (initData: string, text: string, mood?: number) =>
  req<DiaryEntry>('/api/diary', initData, {
    method: 'POST',
    body: JSON.stringify({ text, mood }),
  }),

export interface DiaryEntry {
  date: string
  text: string
  mood: number | null
}
```

### `pages/Diary.tsx` (новый файл)

По образцу `Notes.tsx`: `loading`/`err`/empty состояния, список записей (дата + эмодзи настроения если есть + текст), кнопка добавления открывает `BottomSheet` с `TextField(multiline)` + пикер настроения (5 эмодзи-кнопок `😞😕😐🙂😄`, опционально, без выбора — `mood: undefined`).

Эмодзи-мэппинг настроения — тот же словарь, что в боте (`main.py: MOOD_EMOJI`), продублировать константой в `Diary.tsx` (как `STAT_LABELS`/`MOOD_EMOJI` в боте — отдельные модули, общего constants-файла между ботом и Mini App нет, дублирование уже принятый паттерн проекта).

Запись добавляется через `Today.tsx`-подобный модал (используя уже существующие `BottomSheet`/`TextField`), отдельной кнопки «Додати» внутри bottom sheet, как у Notes/Today.

### Точка входа на добавление

`Today.tsx` quick-add — это фиксированный набор из 4 кнопок (вода/задача/нотатка/їжа), дневник туда не входит и не добавляется. Значит у `Diary.tsx` будет собственная кнопка «+ Новий запис» в верхней части списка (там же, где у `Notes.tsx`/`Tasks.tsx` счётчик количества записей) — это единственный вход на добавление для этого экрана.

---

## 3. Обработка ошибок

Идентично остальным страницам: ошибка загрузки списка → текст ошибки вместо списка; ошибка сохранения → текст ошибки внутри bottom sheet (`saveErr`-паттерн из `Today.tsx`).

---

## 4. Тестирование

Без автотестов (принятая конвенция проекта). Проверка:
- `python -m py_compile backend/*.py`
- Ручной smoke-тест новых эндпоинтов через локальный venv против реальной Supabase (тот же подход, что для P1/P2 в этой сессии)
- `tsc -b && vite build`, `npm run lint` для фронтенда
- Код-ревью субагентом перед коммитом

---

## 5. Явно вне скоупа этой итерации

Архив по дате (`/journal <дата>` в боте) · редактирование текста записи · удаление записи · теги/категории записей.
