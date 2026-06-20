package kz.azs.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

/**
 * Совпадает по форме с интерфейсом Shift на фронте.
 * Служит и телом запроса (на вход — только сырые поля, calculated игнорируются
 * и пересчитываются сервером), и телом ответа (calculated заполнены сервером).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ShiftDto(
        String id,
        String operatorId,
        String receivedById,
        String startDate,
        String startTime,
        String endDate,
        String endTime,
        String shiftType,          // full (сутки) | day (день) | night (ночь)
        List<PumpReadingDto> pumps,

        // Ввод владельца — только литры и безнал
        BigDecimal voucherLiters,
        BigDecimal cardLiters,
        BigDecimal discountLiters,
        BigDecimal kaspiQR,
        BigDecimal kaspiTransfer,

        // Цены 107/112 — снапшот смены (на вход игнорируются, при создании берутся
        // из настроек fuel_price; на выход — чтобы показать множитель в форме)
        BigDecimal discountPrice,
        BigDecimal regularPrice,

        // Рассчитанные сервером — строки «как на листе»
        BigDecimal totalLiters,
        BigDecimal discountAmount,   // наличные по 107
        BigDecimal remainderLiters,  // остаток (л)
        BigDecimal baseAmount,       // общая сумма по 112
        BigDecimal cashByBase,       // наличные по 112 (может быть < 0)
        BigDecimal cashByDiscount,   // наличные по 107 (= discountAmount)
        BigDecimal totalCash,        // ИТОГО НАЛИЧНЫМИ
        BigDecimal totalRevenue,     // выручка всего (для журнала/отчёта)

        // Зарплата за смену (рассчитано сервером по настройкам)
        BigDecimal baseSalary,     // ставка по типу смены
        BigDecimal bonus,          // ступенчатый бонус за объём
        BigDecimal payout          // итого за смену = ставка + бонус
) {}
