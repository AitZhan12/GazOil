package kz.azs.web.dto;

import java.math.BigDecimal;

/** Цены 107/112 одной колонки (раздел «Настройки»). */
public record FuelPriceDto(
        int pumpNumber,
        BigDecimal discountPrice,   // льготная (107)
        BigDecimal basePrice        // основная (112)
) {}
