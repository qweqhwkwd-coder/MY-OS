create table diary_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  text       text not null,
  mood       int check (mood between 1 and 5),
  created_at timestamptz not null default now()
);

create index idx_diary on diary_entries(user_id, date);

alter table diary_entries enable row level security;
create policy owns_diary on diary_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
