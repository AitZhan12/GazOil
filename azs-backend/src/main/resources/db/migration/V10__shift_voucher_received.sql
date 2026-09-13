-- Количество талонов, фактически принятых владельцем при инкассации смены.
alter table shift add column voucher_received numeric(12, 2);

alter table shift add constraint chk_shift_voucher_received_nonneg
    check (voucher_received is null or voucher_received >= 0);
