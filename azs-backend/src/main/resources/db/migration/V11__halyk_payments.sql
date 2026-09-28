alter table shift_breakdown
    add column halyk_qr numeric(14,2) not null default 0,
    add column halyk_transfer numeric(14,2) not null default 0;

alter table shift_breakdown
    add constraint chk_breakdown_halyk_nonneg
    check (halyk_qr >= 0 and halyk_transfer >= 0);
