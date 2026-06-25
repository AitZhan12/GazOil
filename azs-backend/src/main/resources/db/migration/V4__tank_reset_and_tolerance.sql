-- V4: погрешность замера при заливке + обнуление резервуара.
-- Замер при заливке газа может расходиться с фактом до ~1000 л, поэтому в пределах
-- погрешности минус/перелив остатка не считаем проблемой. А когда газ заканчивается,
-- остаток принудительно обнуляют — накопленная погрешность списывается, и бегущий
-- остаток считается заново от нуля после этой точки.

-- Допустимая погрешность замера (л). По умолчанию 1000.
alter table salary_config
    add column measurement_tolerance_liters numeric(14,2) not null default 1000;

alter table salary_config
    add constraint chk_salary_config_tolerance_nonneg
        check (measurement_tolerance_liters >= 0);

-- Обнуление резервуара: момент, когда остаток сброшен в ноль (газ закончился).
create table tank_reset (
    id          bigint        generated always as identity primary key,
    station_id  bigint        not null references station(id),
    reset_at    timestamptz   not null,   -- момент обнуления
    note        text,                      -- заметка (необязательно)
    created_at  timestamptz   not null default now()
);
create index idx_tank_reset_station_at on tank_reset(station_id, reset_at);
