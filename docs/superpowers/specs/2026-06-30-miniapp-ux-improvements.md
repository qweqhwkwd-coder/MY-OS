# Mini App UX Improvements — Спек

**Дата:** 2026-06-30  
**Статус:** Підтверджено користувачем  
**Контекст:** Набір дефектів і нових фіч для існуючого Mini App MY-OS після декількох спринтів розвитку.

---

## 0. Підсумок змін

| # | Зміна | Тип |
|---|---|---|
| 1 | SwipeRow — єдиний паттерн редагування/видалення для ВСІХ блоків | нова фіча |
| 2 | Tasks: архів виконаних + текст у 2 рядки | нова фіча |
| 3 | Rituals, Notes: замінити LongPress на SwipeRow | рефактор |
| 4 | Diary: редагування + фільтр по даті | нова фіча |
| 5 | Food: видалення запису + ціль ккал | нова фіча |
| 6 | Today: прогрес-бар ккал відносно цілі | нова фіча |
| 7 | ProfileModal: вкладка «Тіло» з КБЖУ-калькулятором | нова фіча |
| 8 | WelcomeScreen: цитати при кожному відкритті | баг-фікс |

---

## 1. SwipeRow — універсальний компонент

### Поведінка

- `touchstart` → фіксуємо початкову X
- `touchmove` → якщо deltaX від'ємний (вліво), `translateX(deltaX)` до `-totalActionsWidth`; transition вимкнений під час drag
- `touchend`:
  - `|deltaX| > 60px` → снеп до відкритого стану
  - `|deltaX| ≤ 60px` → повернення (transition 200ms ease)
- Свайп вправо → закриває
- Відкриття нового рядка → автоматично закриває попередній (через `openId`/`setOpenId` у батьківському компоненті)
- Тап на кнопку дії → виконує дію + закриває

### Інтерфейс

```tsx
interface SwipeAction {
  label: string
  bgColor: string  // '#dc2626' для Delete, '#374151' для Edit/More
  onClick: () => void
}

interface SwipeRowProps {
  id: string
  openId: string | null
  onOpen: (id: string) => void
  onClose: () => void
  actions: SwipeAction[]     // до 3 кнопок, по 64px кожна
  children: React.ReactNode
}
```

### Застосування по сторінках

| Сторінка | Дії при свайпі |
|---|---|
| Tasks (активні) | [Редагувати `#374151`, Видалити `#dc2626`] |
| Tasks (архів) | [Видалити `#dc2626`] |
| Rituals | [Редагувати `#374151`, Видалити `#dc2626`] |
| Notes | [Опції `#374151`, Видалити `#dc2626`] — "Опції" відкриває BottomSheet конвертації |
| Diary | [Редагувати `#374151`, Видалити `#dc2626`] |
| Food | [Видалити `#dc2626`] |

### Редагування

Всюди де є "Редагувати" — відкриває `BottomSheet` з `TextField` і кнопкою «Зберегти». Не інлайн-інпут (клавіатура на мобільному ламає лейаут).

---

## 2. Tasks

### Активні задачі

- Шапка: два таби `АКТИВНІ` / `АРХІВ`
- Текст рядка: `line-clamp-2` (до 2 рядків, не truncate)
- Кнопка «Готово» праворуч — не бере участь у свайпі
- Свайп вліво → [Редагувати, Видалити]
- "Редагувати" → BottomSheet з TextField

### Архів

- Підвантажується при першому переключенні на вкладку (lazy)
- Джерело: `GET /api/tasks?archive=true`
- Рядок: назва + дата виконання
- Свайп вліво → [Видалити] (остаточне видалення з архіву)
- Без кнопки «Готово»

### Backend

```python
# GET /api/tasks?archive=true
.select("id,title,completed_at")
.eq("is_completed", True)
.gte("completed_at", 30_days_ago_iso)
.order("completed_at", desc=True)
```

Існуючий `GET /api/tasks` (без параметра) — без змін.

---

## 3. Rituals

- Замінити `LongPressButton` на `SwipeRow`
- Свайп → [Редагувати, Видалити]
- Редагування через BottomSheet (замість інлайн-інпуту)
- Тап на рядок (не свайп) — нічого не робить; тап на коло — toggle done (без змін)

---

## 4. Notes

- Замінити `LongPressButton` на `SwipeRow`
- Свайп → [Опції, Видалити]
- "Опції" → відкриває існуючий BottomSheet з конвертацією (→ Завдання, → Щоденник тощо)
- `ActionSheet` видаляється з цієї сторінки

---

## 5. Diary

### Список записів

- `DiaryEntry` отримує поле `id` (backend: `select("id,date,text,mood")`)
- Свайп → [Редагувати, Видалити]
- "Редагувати" → BottomSheet з TextField + вибором настрою, pre-filled поточними значеннями
- "Видалити" → `DELETE /api/diary/{id}` (новий ендпоінт)

### Фільтр по даті

- В шапці: поле `<input type="date">` (праворуч від «ЩОДЕННИК»)
- При виборі дати: `GET /api/diary?date=YYYY-MM-DD` замість `GET /api/diary`
- При очищенні дати: повертається до загального списку (останні 10 записів)

### Backend

```python
# GET /api/diary  (з опціональним параметром)
@router.get("/diary")
def api_diary(date: str | None = None, user: dict = Depends(...)):
    if date:
        return get_diary_entries_by_date(user["id"], date)  # вже є в db.py
    return get_diary_entries(user["id"], limit=30)  # збільшити limit з 10 до 30

# PATCH /api/diary/{entry_id}
# оновлює text і/або mood

# DELETE /api/diary/{entry_id}
# видаляє запис
```

`get_diary_entries_by_date` вже існує в `db.py` — тільки підключити.  
`get_diary_entries` збільшити limit: 10 → 30.

---

## 6. Food

### Видалення

- Свайп → [Видалити]
- `DELETE /api/food/{entry_id}` (новий ендпоінт)
- `FoodEntry.id` вже є в інтерфейсі TypeScript і в SELECT

### Ціль ккал

- Джерело цілі: `kcal_goal` розраховується бекендом із профілю тіла (секція 8)
- `GET /api/today` додає поле `kcal_goal` (якщо профіль тіла не заповнений → `null`)
- Food.tsx: якщо `kcal_goal` є — показувати прогрес-бар (ккал / ціль), інакше — тільки суму

---

## 7. Today

- Якщо `kcal_goal` є → рядок калорій показує прогрес-бар (аналогічно воді)
- Якщо `kcal_goal` null → тільки кількість ккал без бару

---

## 8. ProfileModal — вкладка «Тіло»

### UI

Нова вкладка у ProfileModal (поряд з існуючим контентом — або таби «Профіль» / «Тіло» / «Налаштування»).

Поля форми:
- Вага (кг) — числовий інпут
- Зріст (см) — числовий інпут  
- Вік — числовий інпут
- Рівень активності — 4 варіанти:
  - Низький (офіс, без спорту) — множник 1.2
  - Помірний (спорт 1-3 дні/тиж) — множник 1.375
  - Активний (спорт 3-5 днів/тиж) — множник 1.55
  - Дуже активний (щодня або важка праця) — множник 1.725

Кнопка «Зберегти» → `PATCH /api/users/body`.

Нижче форми: розрахований TDEE (якщо всі поля заповнені):
```
КБЖУ · TDEE: 2 340 ккал
Білки: 175г · Жири: 78г · Вуглеводи: 234г
```
(макронутрієнти: Б = TDEE × 0.30 / 4, Ж = TDEE × 0.30 / 9, В = TDEE × 0.40 / 4)

Формула Міффліна-Сент-Жора:
- Чоловіки: `10 × вага + 6.25 × зріст - 5 × вік + 5`
- Жінки: `10 × вага + 6.25 × зріст - 5 × вік - 161`
- TDEE = BMR × множник активності

Стать не запитуємо (спрощення) — використовуємо чоловічу формулу за замовчуванням (похибка ±5%, прийнятно для MVP).

### Backend

```sql
-- Міграція
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'moderate';
```

```python
# PATCH /api/users/body
# body: {weight_kg, height_cm, age, activity_level}
# зберігає в users, повертає розрахований kcal_goal

# db.py: calculate_kcal_goal(user_id) → int | None
# повертає TDEE або None якщо профіль неповний
```

`GET /api/profile` та `GET /api/today` викликають `calculate_kcal_goal` і додають `kcal_goal` до відповіді.

---

## 9. WelcomeScreen

**Проблема:** `shouldShowWelcome()` перевіряє `localStorage.last_welcome_date !== todayStr()` — екран показується максимум раз на день.

**Рішення:** Показувати при кожному відкритті застосунку.

- Прибрати перевірку дати з `shouldShowWelcome()` → завжди `true`
- Прибрати `localStorage.setItem('last_welcome_date', ...)` з `handleEnter()`
- `localStorage` більше не використовується для цього

Цитата залишається детермінованою по дню (`new Date().getDate() % QUOTES.length`) — в межах одного дня одна й та ж цитата, але показується кожного разу.

---

## Що НЕ входить у цей спринт

- Стать у КБЖУ-профілі (додати пізніше окремо)
- Редагування/видалення записів води (логічно додавати окремо)
- Нові сторінки (Сон, Фінанси, Цілі) — залишаються заблокованими в NavGrid
- Анімація рівня-апу / rank-up

---

## Порядок реалізації

1. Backend: міграція + нові ендпоінти
2. `SwipeRow` компонент
3. Tasks (архів + свайп)
4. Rituals (свайп замість LongPress)
5. Notes (свайп замість LongPress)
6. Diary (id + редагування + дата-фільтр)
7. Food (видалення + ціль)
8. Today (kcal прогрес-бар)
9. ProfileModal (вкладка Тіло)
10. WelcomeScreen (без прив'язки до дати)
