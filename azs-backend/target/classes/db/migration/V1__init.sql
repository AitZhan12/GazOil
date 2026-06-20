-- V1: ядро учёта смен АЗС (бумажный «Отчёт за смену» в реляционном виде).
-- Хранится только то, что вводится с листа. Реализация и все суммы — считаются.
-- Зарплата — по типу смены, бонус — ступенями объёма (редактирует владелец).

create table station (
    id         bigint       generated always as identity primary key,
    name       varchar(255) not null,
    created_at timestamptz  not null default now()
);

create table operator (
    id         bigint       generated always as identity primary key,
    station_id bigint       not null references station(id),
    full_name  varchar(255) not null,
    is_active  boolean      not null default true,
    created_at timestamptz  not null default now()
);
create index idx_operator_station on operator(station_id);

create table shift (
    id                      bigint      generated always as identity primary key,
    station_id              bigint      not null references station(id),
    operator_id             bigint      not null references operator(id),
    accepted_by_operator_id bigint      references operator(id),   -- "смену принял"
    shift_type              varchar(8)  not null,                  -- full=сутки | day | night
    started_at              timestamptz not null,                  -- от «10» 06 23:40
    ended_at                timestamptz not null,                  -- до «11» 06 07:52
    note                    text,                                  -- "для заметки"
    created_at              timestamptz not null default now(),
    constraint chk_shift_time check (ended_at > started_at),
    constraint chk_shift_type check (shift_type in ('full', 'day', 'night'))
);
create index idx_shift_station_started on shift(station_id, started_at);
create index idx_shift_operator        on shift(operator_id);

create table fuel_reading (
    id            bigint        generated always as identity primary key,
    shift_id      bigint        not null references shift(id) on delete cascade,
    pump_number   smallint      not null,                          -- № колонки 1,2,3
    reading_start numeric(12,2) not null,
    reading_end   numeric(12,2) not null,
    realization   numeric(12,2) generated always as (reading_end - reading_start) stored,
    constraint uq_reading_shift_pump    unique (shift_id, pump_number),
    constraint chk_reading_end_ge_start check (reading_end >= reading_start)
);
create index idx_reading_shift on fuel_reading(shift_id);

create table shift_breakdown (
    shift_id        bigint        primary key references shift(id) on delete cascade,
    talony_liters   numeric(10,2) not null default 0,
    card_liters     numeric(10,2) not null default 0,   -- товарная карта
    discount_liters numeric(10,2) not null default 0,
    discount_price  numeric(10,2) not null,             -- льготная цена (дисконт)
    base_price      numeric(10,2) not null,             -- основная цена
    kaspi_qr        numeric(14,2) not null default 0,
    kaspi_transfer  numeric(14,2) not null default 0,
    cash_counted    numeric(14,2) not null default 0,   -- ИТОГО НАЛИЧНЫМИ (факт)
    constraint chk_breakdown_nonneg check (
        talony_liters >= 0 and card_liters >= 0 and discount_liters >= 0
        and discount_price >= 0 and base_price >= 0
        and kaspi_qr >= 0 and kaspi_transfer >= 0 and cash_counted >= 0
    )
);

-- Настройки зарплаты/бонуса — один конфиг на станцию (владелец редактирует).
create table salary_config (
    id                     bigint        generated always as identity primary key,
    station_id             bigint        not null references station(id),
    rate_full              numeric(12,2) not null,   -- ставка за смену «сутки»
    rate_day               numeric(12,2) not null,   -- ставка за смену «день»
    rate_night             numeric(12,2) not null,   -- ставка за смену «ночь»
    default_discount_price numeric(10,2) not null,   -- льготная цена по умолчанию
    default_base_price     numeric(10,2) not null,   -- основная цена по умолчанию
    constraint uq_salary_config_station unique (station_id),
    constraint chk_salary_config_nonneg check (
        rate_full >= 0 and rate_day >= 0 and rate_night >= 0
        and default_discount_price >= 0 and default_base_price >= 0
    )
);

-- Ступени бонуса: «объём перешагнул планку → бонус». Берётся высшая достигнутая ступень.
create table bonus_tier (
    id               bigint        generated always as identity primary key,
    config_id        bigint        not null references salary_config(id) on delete cascade,
    threshold_liters numeric(12,2) not null,   -- планка объёма (литры)
    bonus_amount     numeric(12,2) not null,   -- бонус при её достижении (₸)
    constraint uq_bonus_tier_threshold unique (config_id, threshold_liters),
    constraint chk_bonus_tier_nonneg   check (threshold_liters >= 0 and bonus_amount >= 0)
);
create index idx_bonus_tier_config on bonus_tier(config_id);

-- ── Стартовые данные ───────────────────────────────────────────────────────

-- Одна станция по умолчанию: приложение пока однотенантное.
insert into station (name) values ('GazOil');

-- Стартовые операторы.
insert into operator (station_id, full_name, is_active)
select s.id, v.full_name, true
from station s
cross join (values
    ('Иванов Иван Иванович'),
    ('Петрова Анна Сергеевна'),
    ('Сидоров Петр Николаевич'),
    ('Казахова Айгуль Маратовна'),
    ('Смирнов Дмитрий Александрович')
) as v(full_name)
where s.name = 'GazOil';

-- Конфиг ЗП/бонуса по спеке: ставки сутки/день/ночь и цены по умолчанию (газовые 195/205).
insert into salary_config (station_id, rate_full, rate_day, rate_night,
                           default_discount_price, default_base_price)
select s.id, 14000, 7000, 7000, 195, 205
from station s
order by s.id
limit 1;

-- Таблица бонусов по спеке: 3000→1000 … 14000→6000 (потолок).
insert into bonus_tier (config_id, threshold_liters, bonus_amount)
select c.id, v.threshold, v.amount
from salary_config c
cross join (values
    ( 3000, 1000),
    ( 4500, 1500),
    ( 6000, 2000),
    ( 7000, 2500),
    ( 8000, 3000),
    ( 9000, 3500),
    (10000, 4000),
    (11000, 4500),
    (12000, 5000),
    (13000, 5500),
    (14000, 6000)
) as v(threshold, amount);
