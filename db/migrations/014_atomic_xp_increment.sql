-- Атомарное начисление XP: одной командой создаёт строку user_stats (если её
-- ещё нет), увеличивает нужный стат и пересчитывает level — без read-modify-write
-- в Python, который терял XP при параллельных начислениях (бот + Mini App).
create or replace function increment_user_stat(p_user_id uuid, p_stat text, p_amount int)
returns user_stats
language plpgsql
as $$
declare
  result user_stats;
begin
  insert into user_stats (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  update user_stats set
    strength   = strength   + (case when p_stat = 'strength'   then p_amount else 0 end),
    endurance  = endurance  + (case when p_stat = 'endurance'  then p_amount else 0 end),
    nutrition  = nutrition  + (case when p_stat = 'nutrition'  then p_amount else 0 end),
    discipline = discipline + (case when p_stat = 'discipline' then p_amount else 0 end),
    reflection = reflection + (case when p_stat = 'reflection' then p_amount else 0 end),
    health     = health     + (case when p_stat = 'health'     then p_amount else 0 end),
    finance    = finance    + (case when p_stat = 'finance'    then p_amount else 0 end),
    intellect  = intellect  + (case when p_stat = 'intellect'  then p_amount else 0 end)
  where user_id = p_user_id;

  update user_stats set
    level = (strength + endurance + nutrition + discipline + reflection + health + finance + intellect) / 100
  where user_id = p_user_id
  returning * into result;

  return result;
end;
$$;
