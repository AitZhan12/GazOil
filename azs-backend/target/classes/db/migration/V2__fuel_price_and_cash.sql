-- V3: воспроизводим бумажный «Отчёт за смену» один в один.
-- Блок «ИЗ НИХ» — это калькулятор: владелец вводит только литры и безнал,
-- все суммы и «наличные» считаются. Никакой отдельной «ожидаемой кассы» и сверки
-- факт-vs-ожидаемое на листе нет — их и не вводим/не храним.
--
-- Цены 107/112 — общие настройки (одна строка fuel_price). При создании смены
-- они снапшотятся в её shift_breakdown (discount_price/base_price остаются),
-- чтобы прошлые смены не «поехали» при будущем изменении цены.

create table fuel_price (
    id             smallint      primary key default 1,
    discount_price numeric(10,2) not null,
    base_price     numeric(10,2) not null,
    updated_at     timestamptz   not null default now(),
    constraint chk_fuel_price_single check (id = 1)
);
insert into fuel_price(id, discount_price, base_price) values (1, 107, 112);

-- Колонку cash_counted убираем — её семантика была ошибочной («итого наличными»
-- как факт, хотя на листе это вычисление). discount_price/base_price НЕ трогаем —
-- это снапшот цены смены. chk_breakdown_nonneg ссылается на cash_counted,
-- поэтому пересоздаём его без неё.
alter table shift_breakdown drop constraint chk_breakdown_nonneg;
alter table shift_breakdown drop column cash_counted;
alter table shift_breakdown add constraint chk_breakdown_nonneg check (
    talony_liters >= 0 and card_liters >= 0 and discount_liters >= 0
    and discount_price >= 0 and base_price >= 0
    and kaspi_qr >= 0 and kaspi_transfer >= 0
);
