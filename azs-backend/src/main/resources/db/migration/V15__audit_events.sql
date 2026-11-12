create table if not exists audit_event (
    id              bigserial primary key,
    actor_username  varchar(64) not null,
    action          varchar(32) not null,
    entity_type     varchar(32) not null,
    entity_id       varchar(64),
    station_name    varchar(128) not null,
    operator_name   varchar(128),
    details         text,
    occurred_at     timestamptz not null default now()
);

create index if not exists idx_audit_event_occurred_at on audit_event (occurred_at desc);
