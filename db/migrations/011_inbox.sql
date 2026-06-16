create table inbox_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  text       text not null,
  is_handled boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_inbox on inbox_items(user_id, is_handled, created_at);

alter table inbox_items enable row level security;
create policy owns_inbox on inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
