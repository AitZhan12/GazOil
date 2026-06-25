package kz.azs.web.dto;

/** Обнуление резервуара. Дата/время разнесены, как в форме смены и прихода. */
public record TankResetDto(
        String id,
        String date,   // ISO ГГГГ-ММ-ДД
        String time,   // ЧЧ:ММ
        String note    // заметка (необязательно)
) {}
