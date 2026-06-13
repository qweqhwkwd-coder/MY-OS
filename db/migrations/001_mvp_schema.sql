-- ============================================================================
-- MY-OS MVP · 001_mvp_schema.sql
-- Только то, что нужно для первой версии: задачи, ритуалы, вода, питание, RPG.
-- Остальные модули добавим миграциями позже, по одному.
--
-- Запуск: Supabase → SQL Editor → вставить всё → Run.
-- ============================================================================

create extension if not exists pgcrypto;  -- для gen_random_uuid()

-- Пользователь (на MVP он один — ты)
create table users (
  id          uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  name        text,
  timezone    text default 'Europe/Warsaw',
  kcal_goal    int default 2500,
  protein_goal int default 150,
  fat_goal     int default 70,
  carb_goal    int default 300,
  water_goal   int default 2500,   -- мл
  onboarding_completed boolean not null default false,
  created_at  timestamptz not null default now()
);

-- RPG-характеристики (5 статов + общий уровень)
create table user_stats (
  user_id    uuid primary key references users(id) on delete cascade,
  strength   int not null default 0,
  endurance  int not null default 0,
  nutrition  int not null default 0,
  discipline int not null default 0,
  reflection int not null default 0,
  level      int not null default 0,
  xp         int not null default 0,
  updated_at timestamptz not null default now()
);

-- Лог начислений XP (чтобы видеть откуда что пришло)
create table xp_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  source_module text not null,           -- 'tasks' | 'rituals' | 'water' | 'food'
  stat_affected text not null,           -- strength|endurance|nutrition|discipline|reflection
  xp_amount     int not null,
  created_at    timestamptz not null default now()
);

-- Задачи
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  title        text not null,
  priority     text default 'green',     -- red|yellow|green
  deadline     date,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Ритуалы (привычки)
create table rituals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  title        text not null,
  icon         text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Отметки выполнения ритуала по дням
create table ritual_logs (
  id        uuid primary key default gen_random_uuid(),
  ritual_id uuid not null references rituals(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  date      date not null,
  is_done   boolean not null default true,
  unique (ritual_id, date)
);

-- Вода (сумма за день)
create table water_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references users(id) on delete cascade,
  date      date not null,
  amount_ml int not null default 0,
  unique (user_id, date)
);

-- Питание (ручной ввод, без фото)
create table food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  meal_type  text,                        -- breakfast|lunch|dinner|snack
  food_name  text not null,
  kcal       numeric default 0,
  protein    numeric default 0,
  fat        numeric default 0,
  carbs      numeric default 0,
  created_at timestamptz not null default now()
);

-- Индексы под типичные запросы "за сегодня"
create index idx_tasks_user   on tasks(user_id, is_completed, deadline);
create index idx_rituallog    on ritual_logs(user_id, date);
create index idx_water        on water_logs(user_id, date);
create index idx_food         on food_logs(user_id, date);
create index idx_xp           on xp_events(user_id, created_at);

-- ----------------------------------------------------------------------------
-- RLS включаем сразу (хорошая привычка). На MVP бэкенд ходит под service_role
-- и эти политики не мешают; они начнут работать, когда появятся другие люди.
-- ----------------------------------------------------------------------------
alter table users enable row level security;
create policy users_self on users
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
declare tbls text[] := array[
  'user_stats','xp_events','tasks','rituals','ritual_logs','water_logs','food_logs'
];
begin
  foreach t in array tbls loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid());',
      'owns_' || t, t);
  end loop;
end $$;
