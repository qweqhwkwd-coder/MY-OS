create table life_balance (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  health     int check (health between 1 and 10),
  work       int check (work between 1 and 10),
  relations  int check (relations between 1 and 10),
  finance    int check (finance between 1 and 10),
  growth     int check (growth between 1 and 10),
  leisure    int check (leisure between 1 and 10),
  creativity int check (creativity between 1 and 10),
  purpose    int check (purpose between 1 and 10),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index idx_balance on life_balance(user_id, date);

alter table life_balance enable row level security;
create policy owns_balance on life_balance
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
