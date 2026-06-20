package kz.azs.service;

import kz.azs.domain.FuelReading;
import kz.azs.domain.Operator;
import kz.azs.domain.SalaryConfig;
import kz.azs.domain.Shift;
import kz.azs.domain.ShiftBreakdown;
import kz.azs.web.dto.OperatorDto;
import kz.azs.web.dto.PumpReadingDto;
import kz.azs.web.dto.ShiftDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

/** Перевод доменных сущностей в DTO формы фронта и обратно. */
@Component
public class AzsMapper {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final ShiftCalculator calculator;
    private final SalaryCalculator salary;

    public AzsMapper(ShiftCalculator calculator, SalaryCalculator salary) {
        this.calculator = calculator;
        this.salary = salary;
    }

    public OperatorDto toDto(Operator op) {
        return new OperatorDto(
                String.valueOf(op.getId()),
                op.getFullName(),
                op.isActive()
        );
    }

    public ShiftDto toDto(Shift shift, SalaryConfig config) {
        ShiftBreakdown b = shift.getBreakdown();

        List<PumpReadingDto> pumps = shift.getReadings().stream()
                .sorted(Comparator.comparing(FuelReading::getPumpNumber))
                .map(r -> new PumpReadingDto(
                        r.getPumpNumber(),
                        r.getReadingStart(),
                        r.getReadingEnd(),
                        // realization — generated-колонка в БД; до её перечитки считаем сами
                        r.getRealization() != null
                                ? r.getRealization()
                                : nz(r.getReadingEnd()).subtract(nz(r.getReadingStart()))
                ))
                .toList();

        BigDecimal totalLiters = pumps.stream()
                .map(PumpReadingDto::volume)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        ShiftCalculator.ShiftResult t = calculator.compute(
                totalLiters,
                nz(b.getTalonyLiters()),
                nz(b.getCardLiters()),
                nz(b.getDiscountLiters()),
                nz(b.getDiscountPrice()),
                nz(b.getBasePrice()),
                nz(b.getKaspiQr()),
                nz(b.getKaspiTransfer())
        );

        OffsetDateTime start = shift.getStartedAt();
        OffsetDateTime end = shift.getEndedAt();

        BigDecimal baseSalary = salary.rateFor(config, shift.getShiftType());
        BigDecimal bonus = salary.bonusFor(config, t.totalLiters());

        return new ShiftDto(
                String.valueOf(shift.getId()),
                String.valueOf(shift.getOperator().getId()),
                shift.getAcceptedBy() != null ? String.valueOf(shift.getAcceptedBy().getId()) : null,
                start.toLocalDate().toString(),
                start.toLocalTime().format(TIME),
                end.toLocalDate().toString(),
                end.toLocalTime().format(TIME),
                shift.getShiftType(),
                pumps,
                nz(b.getTalonyLiters()),
                nz(b.getCardLiters()),
                nz(b.getDiscountLiters()),
                nz(b.getKaspiQr()),
                nz(b.getKaspiTransfer()),
                nz(b.getDiscountPrice()),
                nz(b.getBasePrice()),
                t.totalLiters(),
                t.discountAmount(),
                t.remainderLiters(),
                t.baseAmount(),
                t.cashByBase(),
                t.cashByDiscount(),
                t.totalCash(),
                t.totalRevenue(),
                baseSalary,
                bonus,
                baseSalary.add(bonus)
        );
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
