package kz.azs.web.dto;

import java.math.BigDecimal;

/** Одна ступень бонуса для формы настроек. */
public record BonusTierDto(
        BigDecimal thresholdLiters,
        BigDecimal bonusAmount
) {}
