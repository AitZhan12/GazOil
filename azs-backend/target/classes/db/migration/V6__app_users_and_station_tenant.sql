-- V6: пользователи приложения и разделение данных по газ-точкам.
-- PostgreSQL-роли не используются для входа в UI: владелец входит логином/паролем,
-- а backend выбирает данные только его station_id.

create table app_user (
    id            bigint       generated always as identity primary key,
    station_id    bigint       not null references station(id),
    username      varchar(64)  not null,
    password_salt varchar(64)  not null,
    password_hash varchar(64)  not null,
    api_token     varchar(128) not null,
    is_active     boolean      not null default true,
    created_at    timestamptz  not null default now()
);
create unique index uq_app_user_username_lower on app_user(lower(username));
create unique index uq_app_user_api_token on app_user(api_token);
create index idx_app_user_station on app_user(station_id);

-- Цены теперь тоже отдельные для каждой газ-точки.
alter table fuel_price drop constraint if exists chk_fuel_price_single;
alter table fuel_price add column station_id bigint references station(id);
update fuel_price
set station_id = (select id from station order by id limit 1)
where station_id is null;
alter table fuel_price alter column station_id set not null;
create unique index uq_fuel_price_station on fuel_price(station_id);

insert into station (name)
select v.name
from (values
    ('Газ точка 1'),
    ('Газ точка 2'),
    ('Газ точка 3'),
    ('Газ точка 4'),
    ('Газ точка 5')
) as v(name)
where not exists (select 1 from station s where s.name = v.name);

insert into salary_config (station_id, rate_full, rate_day, rate_night,
                           default_discount_price, default_base_price,
                           initial_stock_liters, tank_capacity_liters,
                           measurement_tolerance_liters)
select s.id, 14000, 7000, 7000, 195, 205, 0, 0, 1000
from station s
where s.name in ('Газ точка 1', 'Газ точка 2', 'Газ точка 3', 'Газ точка 4', 'Газ точка 5')
  and not exists (select 1 from salary_config c where c.station_id = s.id);

insert into bonus_tier (config_id, threshold_liters, bonus_amount)
select c.id, v.threshold, v.amount
from salary_config c
join station s on s.id = c.station_id
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
) as v(threshold, amount)
where s.name in ('Газ точка 1', 'Газ точка 2', 'Газ точка 3', 'Газ точка 4', 'Газ точка 5')
  and not exists (select 1 from bonus_tier bt where bt.config_id = c.id);

with missing as (
    select s.id as station_id,
           (coalesce((select max(id)::int from fuel_price), 0)
            + row_number() over (order by s.id))::smallint as price_id
    from station s
    where not exists (select 1 from fuel_price fp where fp.station_id = s.id)
)
insert into fuel_price (id, station_id, discount_price, base_price)
select price_id, station_id, 107, 112
from missing;

insert into app_user (station_id, username, password_salt, password_hash, api_token, is_active)
select s.id, v.username, v.password_salt, v.password_hash, v.api_token, true
from (values
    ('GazOil',      'admin',   'gazoil-admin',   '7e5d69f5c902467ef7c3fa644490a5919bd7075b04f44ac61abdd99c7b83402d', '716a5dd273228e4b645f50cc8e43c8117a59348c8bfb7694'),
    ('Газ точка 1', 'client1', 'gazoil-client1', '927235430d67e645702eb0c17a1ebe17d15015ec3410ba659c074e8ec22ceae9', '9fcb9055d144c28a8241b6be73758642848a342b8b1268e1'),
    ('Газ точка 2', 'client2', 'gazoil-client2', 'a8611f6707195d5843ebc2b39b5693a3a94a3c573da3714a7943c9d4c1aa1294', 'a3fdaabcac0e445b49f0ae8d5a7f051f7b10ef1f41d86d34'),
    ('Газ точка 3', 'client3', 'gazoil-client3', '70a77e86fc895eebd5e02590350070104d6558497aff2e0a32119cded91d470b', 'f58d4d7c4a915f724bce967beabe1af004249f37c596a03d'),
    ('Газ точка 4', 'client4', 'gazoil-client4', 'b9afc0bdfec61e4c282d3739a269a2e7807fd4dd3a5428933bc15fb4254d0331', 'af7b5e1212a674a160d1bd4cc9ddf1786afa86050f13371f'),
    ('Газ точка 5', 'client5', 'gazoil-client5', 'f4e7d24e6501515a9a391ed53bc76af3aa58187419ad1350859c765a8ef1f4c8', '3f1dc4181e0b66167ace9c36d417c826ab040826200f10e2')
) as v(station_name, username, password_salt, password_hash, api_token)
join station s on s.name = v.station_name
where not exists (select 1 from app_user u where lower(u.username) = lower(v.username));
