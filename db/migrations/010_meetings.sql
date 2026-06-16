create table meetings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  title      text not null,
  date       date not null,
  time       time,
  created_at timestamptz not null default now()
);

create index idx_meetings on meetings(user_id, date);

alter table meetings enable row level security;
create policy owns_meetings on meetings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
