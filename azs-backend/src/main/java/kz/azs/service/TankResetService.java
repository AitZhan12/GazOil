package kz.azs.service;

import kz.azs.domain.Station;
import kz.azs.domain.TankReset;
import kz.azs.repo.StationRepository;
import kz.azs.repo.TankResetRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.TankResetDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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
        return toDto(resets.save(r));
    }

    public TankResetDto update(Long id, TankResetDto dto) {
        TankReset r = resets.findById(id)
                .orElseThrow(() -> new NotFoundException("Обнуление не найдено: " + id));
        apply(r, dto);
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

    private TankResetDto toDto(TankReset r) {
        OffsetDateTime at = r.getResetAt();
        return new TankResetDto(
                String.valueOf(r.getId()),
                at.toLocalDate().toString(),
                at.toLocalTime().format(TIME),
                r.getNote()
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
}
