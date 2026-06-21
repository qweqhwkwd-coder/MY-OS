# База данных

> Назад: [CLAUDE.md](../../CLAUDE.md)

## Где что

Supabase (managed PostgreSQL). Доступ из Python через синхронный `supabase-py`.
Бэкенд ходит под `service_role` → **RLS сейчас обходится** (политики созданы, но «спят»).

## Миграции

Применяются **вручную** через Supabase → SQL Editor, **по одному файлу, отдельным запуском**.
Supabase CLI / Alembic НЕ настроены, версионирования нет.

```
db/migrations/
├── 001_mvp_schema.sql          # users, user_stats(5 статов), xp_events, tasks, rituals, ritual_logs, water_logs, food_logs + RLS
├── 002_add_stats.sql           # +health/finance/intellect/hp в user_stats (восстановлен, см. примечание ниже)
├── 003_sleep_logs.sql
├── 004_transactions.sql
├── 005_diary_entries.sql
├── 006_body_measurements.sql
├── 007_ideas.sql
├── 008_goals.sql
├── 009_workouts.sql
├── 010_meetings.sql
├── 011_inbox.sql
├── 012_life_balance.sql
├── 013_food_grams.sql
└── 014_atomic_xp_increment.sql   # функция increment_user_stat — атомарный get-or-create + XP
```

`002_add_stats.sql` был восстановлен задним числом — оригинальный файл был
потерян/не закоммичен, но `health`/`finance`/`intellect`/`hp` уже были в
боевой БД (код на них опирается). Восстановленная версия использует
`add column if not exists`, поэтому безопасно прогнать её даже если эти
колонки там уже есть.

⚠️ Не склеивать миграции и не перезапускать старые — повторный `create table` падает с `relation already exists`.
⚠️ Существовал черновик на 27 таблиц в заброшенном каталоге — игнорировать, боевая БД = файлы выше.

## Таблицы (001–014)

```sql
users            (id, telegram_id, name, ..., water_goal, onboarding_completed)
user_stats       (user_id, strength, endurance, nutrition, discipline, reflection,
                  health, finance, intellect, level, xp, hp, updated_at)
xp_events        (id, user_id, source_module, stat_affected, xp_amount, created_at)
tasks            (id, user_id, title, priority, deadline, is_completed, completed_at)
rituals          (id, user_id, title, icon, is_active)
ritual_logs      (id, ritual_id, user_id, date, is_done)
water_logs       (id, user_id, date, amount_ml)
food_logs        (id, user_id, date, food_name, kcal, grams, ...)
sleep_logs       (id, user_id, date, sleep_time, wake_time, duration_min)
transactions     (id, user_id, date, amount, category, note)
diary_entries    (id, user_id, date, text, mood)
body_measurements(id, user_id, date, weight)
ideas            (id, user_id, text, status, created_at)
goals            (id, user_id, title, deadline, is_done, done_at)
workouts         (id, user_id, date, activity, duration_min, type)
meetings         (id, user_id, title, date, time)
inbox_items      (id, user_id, text, is_handled, created_at)
life_balance     (id, user_id, date, health, work, relations, finance, growth,
                  leisure, creativity, purpose)
```

Postgres-функция `increment_user_stat(p_user_id, p_stat, p_amount)` (миграция `014`):
атомарно создаёт строку `user_stats`, если её нет, прибавляет нужный стат и
пересчитывает `level`. `backend/db.py`'s `add_xp` и `get_user_stats` вызывают её
через `supabase.rpc(...)` вместо read-modify-write в Python (раньше параллельные
начисления XP могли терять прирост).

## RLS-паттерн

Включён на всех таблицах с первого дня:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_owns_data" ON <table>
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Исключение — будущая общая таблица `exercises` (публичное чтение).

**Важно:** пока бэкенд под `service_role`, RLS не защищает. Реальная изоляция включится с мостом `initData → Supabase JWT` (Фаза 6, мультипользователь). Не считать RLS активной защитой в текущем коде.

## Таблицы, нужные для будущих модулей (по продукту, ещё НЕ созданы)

`activity_templates`, `exercises`, `goal_milestones`, `athletic_profiles`,
`fitness_tests`, `training_programs`, `planned_workouts`, `budgets`, `stats_history`.

(Большинство таблиц из старой версии этого списка — `meetings`, `workouts`,
`diary_entries`, `goals`, `ideas`, `sleep_logs`, `transactions`,
`body_measurements`, `inbox_items`, `life_balance` — уже созданы, см. выше.)

Каждый новый модуль = миграция (новый файл `0NN_*.sql`) + RLS + обработчик в боте + (позже) экран в Mini App.
