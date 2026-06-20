package kz.azs.service;

import kz.azs.domain.BonusTier;
import kz.azs.domain.SalaryConfig;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Зарплата за смену: фиксированная ставка по типу смены + ступенчатый бонус
 * за объём реализации. Один в один с фронтовым lib/calculations.ts.
 */
@Component
public class SalaryCalculator {

    /** Ставка за смену по её типу (full=сутки, day=день, night=ночь). */
    public BigDecimal rateFor(SalaryConfig config, String shiftType) {
        BigDecimal rate = switch (shiftType == null ? "" : shiftType) {
            case "full" -> config.getRateFull();
            case "day" -> config.getRateDay();
            case "night" -> config.getRateNight();
            default -> BigDecimal.ZERO;
        };
        return scale2(rate);
    }

    /**
     * Бонус за объём: берётся высшая ступень, чью планку объём перешагнул.
     * Ниже минимальной планки — 0; выше верхней — её сумма (потолок).
     */
    public BigDecimal bonusFor(SalaryConfig config, BigDecimal liters) {
        BigDecimal vol = liters != null ? liters : BigDecimal.ZERO;
        BigDecimal best = BigDecimal.ZERO;
        BigDecimal bestThreshold = null;
        for (BonusTier t : config.getTiers()) {
            if (t.getThresholdLiters() == null || t.getBonusAmount() == null) {
                continue;
            }
            if (vol.compareTo(t.getThresholdLiters()) >= 0
                    && (bestThreshold == null || t.getThresholdLiters().compareTo(bestThreshold) > 0)) {
                bestThreshold = t.getThresholdLiters();
                best = t.getBonusAmount();
            }
        }
        return scale2(best);
    }

    private static BigDecimal scale2(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }
}
