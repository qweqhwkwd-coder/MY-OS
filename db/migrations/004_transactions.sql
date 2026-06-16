create table transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  amount     numeric not null,
  category   text not null default 'другое',
  note       text,
  created_at timestamptz not null default now()
);

create index idx_transactions on transactions(user_id, date);

alter table transactions enable row level security;
create policy owns_transactions on transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
