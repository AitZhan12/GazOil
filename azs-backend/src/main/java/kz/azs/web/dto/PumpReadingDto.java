package kz.azs.web.dto;

import java.math.BigDecimal;

/** Совпадает по форме с интерфейсом PumpReading на фронте. */
public record PumpReadingDto(
        int pumpNumber,
        BigDecimal start,
        BigDecimal end,
        BigDecimal volume   // считается; на вход игнорируется
) {}
