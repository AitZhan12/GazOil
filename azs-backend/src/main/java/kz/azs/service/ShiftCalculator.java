package kz.azs.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Расчёт блока «ИЗ НИХ» бумажного «Отчёта за смену» один в один с фронтовым
 * lib/calculations.ts. Владелец вводит только литры и безнал — суммы и «наличные»
 * считаются. Отдельной «ожидаемой кассы» и сверки на листе нет.
 */
@Component
public class ShiftCalculator {

    public record PumpSale(
            BigDecimal volume,
            BigDecimal discountLiters,
            BigDecimal discountPrice,
            BigDecimal regularPrice
    ) {}

    /** Строки «как на листе» (всё — деньги/литры; зарплата считается отдельно). */
    public record ShiftResult(
            BigDecimal totalLiters,
            BigDecimal discountAmount,    // наличные по дисконтной карте по 107 = discount_liters × 107
            BigDecimal remainderLiters,   // остаток (литр) = итого − дисконт − талоны − карта
            BigDecimal baseAmount,        // общая сумма по 112 = остаток × 112
            BigDecimal cashByBase,        // наличные по 112 = общая сумма по 112 − безнал (может быть < 0)
            BigDecimal cashByDiscount,    // наличные по 107 = discountAmount
            BigDecimal totalCash,         // ИТОГО НАЛИЧНЫМИ = наличные по 112 + наличные по 107
            BigDecimal totalRevenue       // выручка всего = дисконт + база (для журнала/отчёта)
    ) {}

    public ShiftResult compute(
            List<PumpSale> pumps,
            BigDecimal voucherLiters,
            BigDecimal cardLiters,
            BigDecimal kaspiQR,
            BigDecimal kaspiTransfer,
            BigDecimal halykQR,
            BigDecimal halykTransfer
    ) {
        BigDecimal totalLiters = pumps.stream()
                .map(p -> nz(p.volume())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountAmount = BigDecimal.ZERO;
        BigDecimal baseAmount = BigDecimal.ZERO;
        BigDecimal regularLiters = BigDecimal.ZERO;
        BigDecimal totalRegularBeforeSharedDeductions = pumps.stream()
                .map(p -> nz(p.volume()).subtract(nz(p.discountLiters())).max(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal sharedDeductions = nz(voucherLiters).add(nz(cardLiters));
        for (PumpSale pump : pumps) {
            BigDecimal volume = nz(pump.volume());
            BigDecimal discountLitersForPump = nz(pump.discountLiters());
            BigDecimal regularBeforeShared = volume.subtract(discountLitersForPump).max(BigDecimal.ZERO);
            BigDecimal sharedForPump = totalRegularBeforeSharedDeductions.signum() == 0
                    ? BigDecimal.ZERO
                    : sharedDeductions.multiply(regularBeforeShared)
                        .divide(totalRegularBeforeSharedDeductions, 8, RoundingMode.HALF_UP);
            BigDecimal regular = regularBeforeShared.subtract(sharedForPump);
            discountAmount = discountAmount.add(discountLitersForPump.multiply(nz(pump.discountPrice())));
            baseAmount = baseAmount.add(regular.multiply(nz(pump.regularPrice())));
            regularLiters = regularLiters.add(regular);
        }
        BigDecimal remainder = regularLiters;
        BigDecimal totalRevenue = discountAmount.add(baseAmount);

        // «Наличные по 112» на листе бывают отрицательными (Kaspi QR > суммы по 112) —
        // это нормально, НЕ клампим.
        BigDecimal cashByBase = baseAmount.subtract(kaspiQR).subtract(kaspiTransfer)
                .subtract(halykQR).subtract(halykTransfer);
        BigDecimal cashByDiscount = discountAmount;
        BigDecimal totalCash = cashByBase.add(cashByDiscount);

        // Все суммы и литры — до сотых (HALF_UP), как просили в учёте.
        return new ShiftResult(
                s2(totalLiters), s2(discountAmount), s2(remainder), s2(baseAmount),
                s2(cashByBase), s2(cashByDiscount), s2(totalCash), s2(totalRevenue));
    }

    private static BigDecimal s2(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
