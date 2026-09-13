-- Фактически принятая владельцем наличность по смене.
-- NULL у старых инкассированных смен означает, что они были подтверждены до
-- появления точного учёта суммы и не должны формировать искусственный долг.
alter table shift add column cash_received numeric(14, 2);

alter table shift add constraint chk_shift_cash_received_nonneg
    check (cash_received is null or cash_received >= 0);
