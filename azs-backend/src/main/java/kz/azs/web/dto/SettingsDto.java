package kz.azs.web.dto;

import java.math.BigDecimal;
import java.util.List;

/** Настройки зарплаты и бонуса, редактируемые владельцем (раздел «Настройки»). */
public record SettingsDto(
        BigDecimal rateFull,               // ставка за смену «сутки»
        BigDecimal rateDay,                // ставка за смену «день»
        BigDecimal rateNight,              // ставка за смену «ночь»
        BigDecimal defaultDiscountPrice,   // льготная цена по умолчанию
        BigDecimal defaultBasePrice,       // основная цена по умолчанию
        BigDecimal initialStockLiters,        // начальный остаток газа в резервуаре
        BigDecimal tankCapacityLiters,        // объём резервуара (0 = без контроля перелива)
        BigDecimal measurementToleranceLiters, // погрешность замера при заливке (л)
        List<BonusTierDto> bonusTiers         // ступени бонуса (по возрастанию планки)
) {}
