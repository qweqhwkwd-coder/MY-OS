create table ideas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  text       text not null,
  status     text not null default 'raw',  -- raw|in_progress|done|archived
  created_at timestamptz not null default now()
);

create index idx_ideas on ideas(user_id, status, created_at);

alter table ideas enable row level security;
create policy owns_ideas on ideas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
