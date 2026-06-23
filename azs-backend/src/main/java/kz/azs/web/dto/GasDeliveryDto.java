package kz.azs.web.dto;

import java.math.BigDecimal;

/** Приход газа (поставка). Дата/время разнесены, как в форме смены. */
public record GasDeliveryDto(
        String id,
        String date,        // ISO ГГГГ-ММ-ДД
        String time,        // ЧЧ:ММ
        BigDecimal liters,  // объём прихода (л)
        String supplier,    // поставщик (необязательно)
        String note         // заметка
) {}
