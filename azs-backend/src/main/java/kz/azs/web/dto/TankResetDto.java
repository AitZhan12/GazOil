package kz.azs.web.dto;

import java.math.BigDecimal;
import java.util.List;

/** Обнуление резервуара. Дата/время разнесены, как в форме смены и прихода. */
public record TankResetDto(
        String id,
        String date,                    // ISO ГГГГ-ММ-ДД
        String time,                    // ЧЧ:ММ
        String note,                    // заметка (необязательно)
        List<BigDecimal> pumpReadings   // показания колонок 1,2,3 на момент обнуления
) {}
