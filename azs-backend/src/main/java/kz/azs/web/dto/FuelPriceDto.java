package kz.azs.web.dto;

import java.math.BigDecimal;

/** Общие цены 107/112 (раздел «Настройки»). */
public record FuelPriceDto(
        BigDecimal discountPrice,   // льготная (107)
        BigDecimal basePrice        // основная (112)
) {}
