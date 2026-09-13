package kz.azs.service;

import kz.azs.domain.FuelPrice;
import kz.azs.domain.FuelReading;
import kz.azs.domain.Operator;
import kz.azs.domain.SalaryConfig;
import kz.azs.domain.Station;
import kz.azs.domain.Shift;
import kz.azs.domain.ShiftBreakdown;
import kz.azs.repo.OperatorRepository;
import kz.azs.repo.ShiftRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.PumpReadingDto;
import kz.azs.web.dto.ShiftDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@Transactional
public class ShiftService {

    private final ShiftRepository shifts;
    private final OperatorRepository operators;
    private final SettingsService settings;
    private final FuelPriceService fuelPrices;
    private final AzsMapper mapper;
    private final AuthService auth;

    public ShiftService(ShiftRepository shifts, OperatorRepository operators,
                        SettingsService settings, FuelPriceService fuelPrices,
                        AzsMapper mapper, AuthService auth) {
        this.shifts = shifts;
        this.operators = operators;
        this.settings = settings;
        this.fuelPrices = fuelPrices;
        this.mapper = mapper;
        this.auth = auth;
    }

    @Transactional(readOnly = true)
    public List<ShiftDto> list() {
        SalaryConfig config = settings.requireConfig();
        return shifts.findAllByStationIdOrderByStartedAtDesc(auth.currentStation().getId()).stream()
                .map(s -> mapper.toDto(s, config)).toList();
    }

    @Transactional(readOnly = true)
    public ShiftDto get(Long id) {
        return mapper.toDto(load(id), settings.requireConfig());
    }

    public ShiftDto create(ShiftDto dto) {
        Shift shift = new Shift();
        shift.setStation(auth.currentStation());
        apply(shift, dto);
        validateOpeningReadingsUnlessOverlapping(shift, null);
        // Цены 107/112 владелец в форме не вводит — снапшотим из настроек на момент
        // создания, чтобы будущая правка цены не «двигала» эту смену.
        FuelPrice price = fuelPrices.requireCurrent();
        ShiftBreakdown b = shift.getBreakdown();
        b.setDiscountPrice(price.getDiscountPrice());
        b.setBasePrice(price.getBasePrice());
        return mapper.toDto(shifts.save(shift), settings.requireConfig());
    }

    public ShiftDto update(Long id, ShiftDto dto) {
        Shift shift = load(id);
        // Удаляем старые показания и сбрасываем в БД ДО вставки новых,
        // иначе INSERT с тем же (shift_id, pump_number) упрётся в unique-constraint.
        shift.getReadings().clear();
        shifts.flush();
        apply(shift, dto);
        validateOpeningReadingsUnlessOverlapping(shift, id);
        return mapper.toDto(shifts.save(shift), settings.requireConfig());
    }

    public void delete(Long id) {
        Station station = auth.currentStation();
        if (!shifts.existsByIdAndStationId(id, station.getId())) {
            throw new NotFoundException("Смена не найдена: " + id);
        }
        shifts.deleteById(id);
    }

    public ShiftDto setCashCollected(Long id, boolean collected, BigDecimal cashReceived) {
        Shift shift = load(id);
        if (collected) {
            if (cashReceived == null || cashReceived.signum() < 0) {
                throw new IllegalArgumentException("Укажите фактически принятую сумму");
            }
            BigDecimal expectedCash = mapper.toDto(shift, settings.requireConfig()).totalCash().max(BigDecimal.ZERO);
            if (cashReceived.compareTo(expectedCash) > 0) {
                throw new IllegalArgumentException("Принятая сумма не может быть больше кассы смены");
            }
            shift.setCashReceived(cashReceived);
        } else {
            shift.setCashReceived(null);
        }
        shift.setCashCollected(collected);
        return mapper.toDto(shifts.save(shift), settings.requireConfig());
    }

    /** Переносит сырые поля DTO в сущность (операторы, время, колонки, разбивка). */
    private void apply(Shift shift, ShiftDto dto) {
        shift.setOperator(operatorRef(dto.operatorId(), "Оператор"));
        shift.setAcceptedBy(dto.receivedById() != null && !dto.receivedById().isBlank()
                ? operatorRef(dto.receivedById(), "Принявший смену")
                : null);
        OffsetDateTime shiftStart = toUtc(dto.startDate(), dto.startTime());
        OffsetDateTime shiftEnd = toUtc(dto.endDate(), dto.endTime());
        if (!shiftEnd.isAfter(shiftStart)) {
            throw new IllegalArgumentException("Время окончания должно быть позже времени начала");
        }
        // Пересечение по времени НЕ блокирует сохранение — фронт лишь предупреждает
        // красным. Это нужно, чтобы можно было вносить исторические смены (месяц назад
        // и т.п.), даже если границы совпадают или накладываются.
        shift.setStartedAt(shiftStart);
        shift.setEndedAt(shiftEnd);
        shift.setShiftType(normalizeShiftType(dto.shiftType()));

        if (dto.pumps() != null) {
            for (PumpReadingDto p : dto.pumps()) {
                // пустые строки колонок (нет начала и конца) не сохраняем
                BigDecimal start = nz(p.start());
                BigDecimal end = nz(p.end());
                if (start.signum() == 0 && end.signum() == 0) {
                    continue;
                }
                FuelReading r = new FuelReading();
                r.setPumpNumber((short) p.pumpNumber());
                r.setReadingStart(start);
                r.setReadingEnd(end);
                shift.addReading(r);
            }
        }

        ShiftBreakdown b = shift.getBreakdown();
        if (b == null) {
            b = new ShiftBreakdown();
            shift.setBreakdown(b);
        }
        // Ввод владельца — только литры и безнал. Цены 107/112 НЕ берём из формы:
        // на создании снапшотятся из настроек (см. create), при правке — остаются.
        b.setTalonyLiters(nz(dto.voucherLiters()));
        b.setCardLiters(nz(dto.cardLiters()));
        b.setDiscountLiters(nz(dto.discountLiters()));
        b.setKaspiQr(nz(dto.kaspiQR()));
        b.setKaspiTransfer(nz(dto.kaspiTransfer()));
    }

    private Shift load(Long id) {
        return shifts.findWithDetailsByIdAndStationId(id, auth.currentStation().getId())
                .orElseThrow(() -> new NotFoundException("Смена не найдена: " + id));
    }

    /**
     * Для последовательных смен начало счётчика обязано совпадать с предыдущим
     * концом. У пересекающихся по времени смен общего «предыдущего» показания нет,
     * поэтому их сохраняем, как и обещает предупреждение в форме.
     */
    private void validateOpeningReadingsUnlessOverlapping(Shift shift, Long excludeId) {
        if (!shifts.findOverlapping(
                shift.getStation().getId(), shift.getStartedAt(), shift.getEndedAt(), excludeId
        ).isEmpty()) {
            return;
        }

        for (FuelReading reading : shift.getReadings()) {
            List<FuelReading> previous = shifts.findPreviousReading(
                    shift.getStation().getId(),
                    reading.getPumpNumber(),
                    shift.getStartedAt(),
                    excludeId,
                    PageRequest.of(0, 1)
            );
            if (previous.isEmpty()) {
                continue;
            }

            BigDecimal expectedStart = previous.get(0).getReadingEnd();
            if (reading.getReadingStart().compareTo(expectedStart) != 0) {
                throw new IllegalArgumentException(
                        "Колонка " + reading.getPumpNumber()
                                + ": начальное показание должно совпадать с конечным показанием предыдущей смены ("
                                + expectedStart + ")"
                );
            }
        }
    }

    private Operator operatorRef(String id, String label) {
        long opId;
        try {
            opId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            throw new NotFoundException(label + " не найден: " + id);
        }
        return operators.findByIdAndStationId(opId, auth.currentStation().getId())
                .orElseThrow(() -> new NotFoundException(label + " не найден: " + id));
    }

    /** Допустимы только full|day|night; иначе по умолчанию «сутки». */
    private static String normalizeShiftType(String raw) {
        if (raw == null) return "full";
        return switch (raw) {
            case "full", "day", "night" -> raw;
            default -> "full";
        };
    }

    private static OffsetDateTime toUtc(String date, String time) {
        return LocalDate.parse(date)
                .atTime(LocalTime.parse(time))
                .atOffset(ZoneOffset.UTC);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
