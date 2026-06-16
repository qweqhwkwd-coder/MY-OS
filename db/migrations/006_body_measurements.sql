create table body_measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  weight     numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index idx_body on body_measurements(user_id, date);

alter table body_measurements enable row level security;
create policy owns_body on body_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
