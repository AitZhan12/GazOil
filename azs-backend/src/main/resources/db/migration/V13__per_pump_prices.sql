-- V13: цены и скидочные литры задаются отдельно для каждой колонки.

alter table fuel_price
    drop constraint if exists chk_fuel_price_single;

alter table fuel_price
    add column if not exists pump_number smallint not null default 1;

drop index if exists uq_fuel_price_station;
create unique index if not exists uq_fuel_price_station_pump
    on fuel_price(station_id, pump_number);

-- Историческая цена станции становится ценой первой колонки.
with missing as (
    select s.id as station_id,
           row_number() over (order by s.id, n.number) as rn,
           n.number as pump_number
    from station s
    join fuel_price base on base.station_id = s.id and base.pump_number = 1
    cross join lateral generate_series(2, s.pump_count) as n(number)
    where not exists (
        select 1 from fuel_price p2
        where p2.station_id = s.id and p2.pump_number = n.number
    )
), next_id as (
    select coalesce(max(id), 0)::int as value from fuel_price
)
insert into fuel_price (id, station_id, pump_number, discount_price, base_price, updated_at)
select (next_id.value + missing.rn)::smallint,
       missing.station_id,
       missing.pump_number,
       base.discount_price,
       base.base_price,
       base.updated_at
from missing
join fuel_price base
  on base.station_id = missing.station_id and base.pump_number = 1
cross join next_id;

alter table fuel_reading
    add column if not exists discount_liters numeric(10,2) not null default 0,
    add column if not exists discount_price numeric(10,2),
    add column if not exists base_price numeric(10,2);

-- Переносим старые общие скидочные литры пропорционально реализации колонок.
update fuel_reading r
set discount_liters = case
        when totals.total_liters > 0
        then round((b.discount_liters * r.realization / totals.total_liters)::numeric, 2)
        else 0
    end,
    discount_price = b.discount_price,
    base_price = b.base_price
from shift s,
     shift_breakdown b,
     (
    select shift_id, sum(realization) as total_liters
    from fuel_reading
    group by shift_id
) totals
where r.shift_id = s.id
  and b.shift_id = s.id
  and totals.shift_id = r.shift_id
  and (r.discount_price is null or r.base_price is null);

update fuel_reading
set discount_price = coalesce(discount_price, 0),
    base_price = coalesce(base_price, 0);

alter table fuel_reading
    alter column discount_price set not null,
    alter column base_price set not null;

alter table fuel_reading
    add constraint chk_reading_discount_nonneg
    check (discount_liters >= 0 and discount_price >= 0 and base_price >= 0);
