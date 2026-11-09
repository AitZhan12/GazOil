-- V12: две независимые заправки одного клиента.

alter table station
    add column if not exists pump_count smallint not null default 3;

update station
set name = 'АГЗС10'
where name = 'GazOil';

insert into station (name, pump_count)
select 'ГНП', 2
where not exists (select 1 from station where name = 'ГНП');

create table app_user_station (
    user_id    bigint not null references app_user(id) on delete cascade,
    station_id bigint not null references station(id) on delete cascade,
    primary key (user_id, station_id)
);

insert into app_user_station (user_id, station_id)
select id, station_id
from app_user
on conflict do nothing;

insert into app_user_station (user_id, station_id)
select u.id, s.id
from app_user u
cross join station s
where s.name in ('АГЗС10', 'ГНП')
on conflict do nothing;

-- ГНП начинается без истории, операторов и приходов, но доступна для настройки.
insert into salary_config (
    station_id, rate_full, rate_day, rate_night,
    default_discount_price, default_base_price,
    initial_stock_liters, tank_capacity_liters, measurement_tolerance_liters
)
select s.id, 0, 0, 0, 0, 0, 0, 0, 0
from station s
where s.name = 'ГНП'
  and not exists (select 1 from salary_config c where c.station_id = s.id);

with missing as (
    select s.id as station_id, row_number() over (order by s.id) as rn
    from station s
    where s.name = 'ГНП'
      and not exists (select 1 from fuel_price p where p.station_id = s.id)
), next_id as (
    select coalesce(max(id), 0) as value from fuel_price
)
insert into fuel_price (id, station_id, discount_price, base_price)
select (next_id.value + missing.rn)::smallint, missing.station_id, 0, 0
from missing cross join next_id;
