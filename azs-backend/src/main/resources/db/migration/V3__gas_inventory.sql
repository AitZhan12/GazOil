-- V3: контроль запаса газа в резервуаре — приход (поставки) и бегущий остаток.
-- Остаток на момент времени = начальный остаток + Σ(приход) − Σ(реализация смен),
-- считается по времени. Сам остаток нигде не храним: его выводит фронт по поставкам,
-- сменам и начальному остатку. Здесь только сырьё — журнал поставок и две настройки.

-- Начальный остаток и объём резервуара — в singleton-настройках станции.
alter table salary_config
    add column initial_stock_liters numeric(14,2) not null default 0,  -- остаток на старте учёта
    add column tank_capacity_liters numeric(14,2) not null default 0;  -- объём резервуара (0 = без контроля перелива)

alter table salary_config
    add constraint chk_salary_config_stock_nonneg
        check (initial_stock_liters >= 0 and tank_capacity_liters >= 0);

-- Журнал прихода газа (поставки). Дата/время — как у смены.
create table gas_delivery (
    id           bigint        generated always as identity primary key,
    station_id   bigint        not null references station(id),
    delivered_at timestamptz   not null,                 -- дата/время прихода
    liters       numeric(14,2) not null,                 -- объём прихода (л)
    supplier     varchar(255),                           -- поставщик (необязательно)
    note         text,                                   -- заметка
    created_at   timestamptz   not null default now(),
    constraint chk_delivery_liters_pos check (liters > 0)
);
create index idx_delivery_station_at on gas_delivery(station_id, delivered_at);
