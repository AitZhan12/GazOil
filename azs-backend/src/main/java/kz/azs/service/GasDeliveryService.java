package kz.azs.service;

import kz.azs.domain.GasDelivery;
import kz.azs.domain.Station;
import kz.azs.repo.GasDeliveryRepository;
import kz.azs.repo.StationRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.GasDeliveryDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Журнал прихода газа (поставки). Бегущий остаток считает фронт по этим записям. */
@Service
@Transactional
public class GasDeliveryService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final GasDeliveryRepository deliveries;
    private final StationRepository stations;

    public GasDeliveryService(GasDeliveryRepository deliveries, StationRepository stations) {
        this.deliveries = deliveries;
        this.stations = stations;
    }

    @Transactional(readOnly = true)
    public List<GasDeliveryDto> list() {
        return deliveries.findAllByOrderByDeliveredAtAsc().stream().map(this::toDto).toList();
    }

    public GasDeliveryDto create(GasDeliveryDto dto) {
        GasDelivery d = new GasDelivery();
        d.setStation(defaultStation());
        apply(d, dto);
        return toDto(deliveries.save(d));
    }

    public GasDeliveryDto update(Long id, GasDeliveryDto dto) {
        GasDelivery d = deliveries.findById(id)
                .orElseThrow(() -> new NotFoundException("Поставка не найдена: " + id));
        apply(d, dto);
        return toDto(deliveries.save(d));
    }

    public void delete(Long id) {
        if (!deliveries.existsById(id)) {
            throw new NotFoundException("Поставка не найдена: " + id);
        }
        deliveries.deleteById(id);
    }

    /** Переносит сырые поля DTO в сущность с проверкой объёма. */
    private void apply(GasDelivery d, GasDeliveryDto dto) {
        BigDecimal liters = nz(dto.liters());
        if (liters.signum() <= 0) {
            throw new IllegalArgumentException("Объём прихода должен быть больше нуля");
        }
        d.setDeliveredAt(toUtc(dto.date(), dto.time()));
        d.setLiters(liters);
        d.setSupplier(blankToNull(dto.supplier()));
        d.setNote(blankToNull(dto.note()));
    }

    private GasDeliveryDto toDto(GasDelivery d) {
        OffsetDateTime at = d.getDeliveredAt();
        return new GasDeliveryDto(
                String.valueOf(d.getId()),
                at.toLocalDate().toString(),
                at.toLocalTime().format(TIME),
                d.getLiters(),
                d.getSupplier(),
                d.getNote()
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
