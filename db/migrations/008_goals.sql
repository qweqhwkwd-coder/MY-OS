create table goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  title      text not null,
  deadline   date,
  is_done    boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create index idx_goals on goals(user_id, is_done, created_at);

alter table goals enable row level security;
create policy owns_goals on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
