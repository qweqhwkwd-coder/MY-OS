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
├── 001_mvp_schema.sql   # 8 таблиц + RLS
└── 002_add_stats.sql    # +health, finance, intellect в user_stats (int default 0)
```

⚠️ Не склеивать миграции и не перезапускать старые — повторный `create table` падает с `relation already exists`.
⚠️ Существовал черновик на 27 таблиц в заброшенном каталоге — игнорировать, боевая БД = `001` + `002`.

## Таблицы в MVP (001 + 002)

```sql
users        (id, telegram_id, name, ..., onboarding_completed)
user_stats   (id, user_id, strength, endurance, nutrition, discipline,
              reflection, health, finance, intellect, level, xp, updated_at)
xp_events    (id, user_id, source_module, source_id, stat_affected, xp_amount, created_at)
tasks        (создана, кода нет)
rituals      (id, user_id, title, icon, reminder_time, days_of_week, is_active)
ritual_logs  (id, ritual_id, user_id, date, is_done)
water_logs   (id, user_id, date, amount_ml)
food_logs    (создана, кода нет)
```

## RLS-паттерн

Включён на всех таблицах с первого дня:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_owns_data" ON <table>
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Исключение — будущая общая таблица `exercises` (публичное чтение).

**Важно:** пока бэкенд под `service_role`, RLS не защищает. Реальная изоляция включится с мостом `initData → Supabase JWT` (Фаза 6, мультипользователь). Не считать RLS активной защитой в текущем коде.

## Таблицы, нужные для будущих модулей (по продукту, ещё не созданы)

`meetings`, `activity_templates`, `workouts`, `exercises`, `diary_entries`, `goals`, `goal_milestones`, `ideas`, `athletic_profiles`, `fitness_tests`, `training_programs`, `planned_workouts`, `sleep_logs`, `transactions`, `budgets`, `body_measurements`, `inbox_items`, `life_balance`, `stats_history`.

Каждый новый модуль = миграция (новый файл `00N_*.sql`) + RLS + обработчик в боте + (позже) экран в Mini App.
