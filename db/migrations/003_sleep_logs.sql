create table sleep_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  date         date not null,
  sleep_time   time not null,
  wake_time    time not null,
  duration_min int not null,
  quality      int,
  created_at   timestamptz not null default now(),
  unique (user_id, date)
);

create index idx_sleep on sleep_logs(user_id, date);

alter table sleep_logs enable row level security;
create policy owns_sleep_logs on sleep_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
