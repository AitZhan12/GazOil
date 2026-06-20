package kz.azs.service;

import kz.azs.domain.FuelPrice;
import kz.azs.domain.FuelReading;
import kz.azs.domain.Operator;
import kz.azs.domain.SalaryConfig;
import kz.azs.domain.Shift;
import kz.azs.domain.ShiftBreakdown;
import kz.azs.repo.OperatorRepository;
import kz.azs.repo.ShiftRepository;
import kz.azs.repo.StationRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.PumpReadingDto;
import kz.azs.web.dto.ShiftDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Transactional
public class ShiftService {

    private final ShiftRepository shifts;
    private final OperatorRepository operators;
    private final StationRepository stations;
    private final SettingsService settings;
    private final FuelPriceService fuelPrices;
    private final AzsMapper mapper;

    public ShiftService(ShiftRepository shifts, OperatorRepository operators,
                        StationRepository stations, SettingsService settings,
                        FuelPriceService fuelPrices, AzsMapper mapper) {
        this.shifts = shifts;
        this.operators = operators;
        this.stations = stations;
        this.settings = settings;
        this.fuelPrices = fuelPrices;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<ShiftDto> list() {
        SalaryConfig config = settings.requireConfig();
        return shifts.findAllByOrderByStartedAtDesc().stream()
                .map(s -> mapper.toDto(s, config)).toList();
    }

    @Transactional(readOnly = true)
    public ShiftDto get(Long id) {
        return mapper.toDto(load(id), settings.requireConfig());
    }

    public ShiftDto create(ShiftDto dto) {
        Shift shift = new Shift();
        shift.setStation(stations.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new NotFoundException("Станция по умолчанию не настроена")));
        apply(shift, dto);
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
        return mapper.toDto(shifts.save(shift), settings.requireConfig());
    }

    public void delete(Long id) {
        if (!shifts.existsById(id)) {
            throw new NotFoundException("Смена не найдена: " + id);
        }
        shifts.deleteById(id);
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
        // Смены не должны накладываться по времени: интервал новой смены не может
        // пересекать уже сохранённую (напр. день до 20:10, а ночь с 19:50 — запрещено).
        List<Shift> overlaps = shifts.findOverlapping(shiftStart, shiftEnd, shift.getId());
        if (!overlaps.isEmpty()) {
            throw new IllegalArgumentException(
                    "Время смены пересекается с другой сменой (" + formatRange(overlaps.get(0))
                            + "). Смены не должны накладываться по времени.");
        }
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
        return shifts.findWithDetailsById(id)
                .orElseThrow(() -> new NotFoundException("Смена не найдена: " + id));
    }

    private Operator operatorRef(String id, String label) {
        long opId;
        try {
            opId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            throw new NotFoundException(label + " не найден: " + id);
        }
        return operators.findById(opId)
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

    private static final DateTimeFormatter RANGE_FMT = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private static String formatRange(Shift s) {
        return s.getStartedAt().format(RANGE_FMT) + "–" + s.getEndedAt().format(RANGE_FMT);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
