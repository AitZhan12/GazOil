package kz.azs.service;

import kz.azs.domain.Station;
import kz.azs.domain.TankReset;
import kz.azs.domain.TankResetReading;
import kz.azs.repo.StationRepository;
import kz.azs.repo.TankResetRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.TankResetDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

/** Журнал обнулений резервуара. Бегущий остаток считает фронт по этим записям. */
@Service
@Transactional
public class TankResetService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final TankResetRepository resets;
    private final StationRepository stations;

    public TankResetService(TankResetRepository resets, StationRepository stations) {
        this.resets = resets;
        this.stations = stations;
    }

    @Transactional(readOnly = true)
    public List<TankResetDto> list() {
        return resets.findAllByOrderByResetAtAsc().stream().map(this::toDto).toList();
    }

    public TankResetDto create(TankResetDto dto) {
        TankReset r = new TankReset();
        r.setStation(defaultStation());
        apply(r, dto);
        addReadings(r, dto);
        return toDto(resets.save(r));
    }

    public TankResetDto update(Long id, TankResetDto dto) {
        TankReset r = resets.findById(id)
                .orElseThrow(() -> new NotFoundException("Обнуление не найдено: " + id));
        apply(r, dto);
        // Полная замена показаний: чистим и сбрасываем в БД до вставки новых,
        // иначе упрёмся в unique (tank_reset_id, pump_number).
        r.getReadings().clear();
        resets.saveAndFlush(r);
        addReadings(r, dto);
        return toDto(resets.save(r));
    }

    public void delete(Long id) {
        if (!resets.existsById(id)) {
            throw new NotFoundException("Обнуление не найдено: " + id);
        }
        resets.deleteById(id);
    }

    private void apply(TankReset r, TankResetDto dto) {
        r.setResetAt(toUtc(dto.date(), dto.time()));
        r.setNote(blankToNull(dto.note()));
    }

    /** Добавляет показания колонок 1..N в порядке списка (номер колонки = индекс + 1). */
    private void addReadings(TankReset r, TankResetDto dto) {
        List<BigDecimal> pumps = dto.pumpReadings();
        if (pumps == null) return;
        for (int i = 0; i < pumps.size(); i++) {
            TankResetReading reading = new TankResetReading();
            reading.setPumpNumber((short) (i + 1));
            reading.setReading(nz(pumps.get(i)));
            r.addReading(reading);
        }
    }

    private TankResetDto toDto(TankReset r) {
        OffsetDateTime at = r.getResetAt();
        List<BigDecimal> pumps = r.getReadings().stream()
                .sorted(Comparator.comparing(TankResetReading::getPumpNumber))
                .map(TankResetReading::getReading)
                .toList();
        return new TankResetDto(
                String.valueOf(r.getId()),
                at.toLocalDate().toString(),
                at.toLocalTime().format(TIME),
                r.getNote(),
                pumps
        );
    }

    private Station defaultStation() {
        return stations.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new NotFoundException("Станция по умолчанию не настроена"));
    }

    private static OffsetDateTime toUtc(String date, String time) {
        LocalTime t = time != null && !time.isBlank() ? LocalTime.parse(time) : LocalTime.MIDNIGHT;
        return LocalDate.parse(date).atTime(t).atOffset(ZoneOffset.UTC);
    }

    private static String blankToNull(String s) {
        return s != null && !s.isBlank() ? s.trim() : null;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
