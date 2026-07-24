alter table shift add column cash_collected boolean not null default false;

create table water_record (
    id bigserial primary key,
    station_id bigint not null references station(id),
    operator_id bigint not null references operator(id),
    recorded_at timestamptz not null,
    received_quantity numeric(12, 2) not null default 0,
    delivery_quantity numeric(12, 2) not null default 0,
    sold_quantity numeric(12, 2) not null default 0,
    created_at timestamptz not null default now()
);

create index water_record_station_recorded_at_idx on water_record(station_id, recorded_at desc);
