-- V5: показания колонок на момент обнуления резервуара.
-- Когда газ закончился, оператор фиксирует показания счётчиков всех колонок —
-- привязка обнуления к конкретным цифрам тотализатора (и точка отсчёта для сверки).
create table tank_reset_reading (
    id            bigint        generated always as identity primary key,
    tank_reset_id bigint        not null references tank_reset(id) on delete cascade,
    pump_number   smallint      not null,                 -- № колонки 1,2,3
    reading       numeric(12,2) not null default 0,       -- показание счётчика
    constraint uq_reset_reading_pump unique (tank_reset_id, pump_number)
);
create index idx_reset_reading_reset on tank_reset_reading(tank_reset_id);
