create table workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  date         date not null,
  activity     text not null,
  duration_min int,
  type         text not null default 'other',  -- cardio|strength|flexibility|other
  created_at   timestamptz not null default now()
);

create index idx_workouts on workouts(user_id, date);

alter table workouts enable row level security;
create policy owns_workouts on workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
