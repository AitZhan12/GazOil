package kz.azs.service;

import kz.azs.domain.Operator;
import kz.azs.domain.WaterRecord;
import kz.azs.repo.OperatorRepository;
import kz.azs.repo.WaterRecordRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.WaterRecordDto;
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
public class WaterRecordService {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private final WaterRecordRepository records;
    private final OperatorRepository operators;
    private final AuthService auth;

    public WaterRecordService(WaterRecordRepository records, OperatorRepository operators, AuthService auth) {
        this.records = records;
        this.operators = operators;
        this.auth = auth;
    }

    @Transactional(readOnly = true)
    public List<WaterRecordDto> list() {
        return records.findAllByStationIdOrderByRecordedAtDesc(auth.currentStation().getId()).stream().map(this::toDto).toList();
    }

    public WaterRecordDto create(WaterRecordDto dto) {
        WaterRecord record = new WaterRecord();
        record.setStation(auth.currentStation());
        apply(record, dto);
        return toDto(records.save(record));
    }

    public WaterRecordDto update(Long id, WaterRecordDto dto) {
        WaterRecord record = load(id);
        apply(record, dto);
        return toDto(records.save(record));
    }

    public void delete(Long id) { records.delete(load(id)); }

    private void apply(WaterRecord record, WaterRecordDto dto) {
        record.setOperator(operator(dto.operatorId()));
        record.setRecordedAt(LocalDate.parse(dto.date()).atTime(LocalTime.parse(dto.time())).atOffset(ZoneOffset.UTC));
        record.setReceivedQuantity(nonNegative(dto.receivedQuantity(), "Остаток при приеме"));
        record.setDeliveryQuantity(nonNegative(dto.deliveryQuantity(), "Приход"));
        record.setSoldQuantity(nonNegative(dto.soldQuantity(), "Продано"));
    }

    private WaterRecord load(Long id) {
        return records.findByIdAndStationId(id, auth.currentStation().getId())
                .orElseThrow(() -> new NotFoundException("Запись воды не найдена: " + id));
    }

    private Operator operator(String id) {
        try {
            return operators.findByIdAndStationId(Long.parseLong(id), auth.currentStation().getId())
                    .orElseThrow(() -> new NotFoundException("Оператор не найден: " + id));
        } catch (NumberFormatException e) { throw new NotFoundException("Оператор не найден: " + id); }
    }

    private WaterRecordDto toDto(WaterRecord r) {
        BigDecimal balance = r.getReceivedQuantity().add(r.getDeliveryQuantity()).subtract(r.getSoldQuantity());
        return new WaterRecordDto(String.valueOf(r.getId()), String.valueOf(r.getOperator().getId()),
                r.getRecordedAt().toLocalDate().toString(), r.getRecordedAt().toLocalTime().format(TIME),
                r.getReceivedQuantity(), r.getDeliveryQuantity(), r.getSoldQuantity(), balance);
    }

    private static BigDecimal nonNegative(BigDecimal value, String name) {
        BigDecimal result = value == null ? BigDecimal.ZERO : value;
        if (result.signum() < 0) throw new IllegalArgumentException(name + " не может быть отрицательным");
        return result;
    }
}
