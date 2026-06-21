-- Восстановлено по памяти/коду: оригинальный файл потерян (не закоммичен),
-- но эти колонки уже применены к боевой БД — backend/db.py активно ими
-- пользуется (health/finance/intellect — статы RPG, hp — health points,
-- считается calculate_hp). IF NOT EXISTS — безопасно прогнать даже повторно,
-- если миграция уже была применена раньше под другим/без файла.
alter table user_stats add column if not exists health    int not null default 0;
alter table user_stats add column if not exists finance   int not null default 0;
alter table user_stats add column if not exists intellect int not null default 0;
alter table user_stats add column if not exists hp        int not null default 0;
