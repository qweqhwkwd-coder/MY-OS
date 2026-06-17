-- Додаємо поле grams до food_logs (необов'язкове)
alter table food_logs
  add column if not exists grams integer;
