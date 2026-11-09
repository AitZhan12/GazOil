package kz.azs.service;

import kz.azs.domain.FuelPrice;
import kz.azs.repo.FuelPriceRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.FuelPriceDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Цены 107/112 по колонкам станции. Снапшотятся в показаниях смены. */
@Service
@Transactional
public class FuelPriceService {

    private final FuelPriceRepository prices;
    private final AuthService auth;

    public FuelPriceService(FuelPriceRepository prices, AuthService auth) {
        this.prices = prices;
        this.auth = auth;
    }

    /** Доменная строка — нужна сервису смен для снапшота цены в новую смену. */
    @Transactional(readOnly = true)
    public Map<Short, FuelPrice> currentByPump() {
        List<FuelPrice> current = prices.findAllByStationIdOrderByPumpNumber(auth.currentStation().getId());
        if (current.isEmpty()) throw new NotFoundException("Цены топлива не настроены");
        Map<Short, FuelPrice> result = new HashMap<>();
        current.forEach(price -> result.put(price.getPumpNumber(), price));
        return result;
    }

    @Transactional(readOnly = true)
    public List<FuelPriceDto> get() {
        return currentByPump().values().stream().sorted((a, b) -> Short.compare(a.getPumpNumber(), b.getPumpNumber()))
                .map(FuelPriceService::toDto).toList();
    }

    public List<FuelPriceDto> update(List<FuelPriceDto> dtos) {
        Map<Short, FuelPrice> current = currentByPump();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        for (FuelPriceDto dto : dtos) {
            FuelPrice p = current.get((short) dto.pumpNumber());
            if (p == null) throw new NotFoundException("Цена колонки не настроена: " + dto.pumpNumber());
            p.setDiscountPrice(nz(dto.discountPrice()));
            p.setBasePrice(nz(dto.basePrice()));
            p.setUpdatedAt(now);
        }
        prices.saveAll(current.values());
        return get();
    }

    private static FuelPriceDto toDto(FuelPrice p) {
        return new FuelPriceDto(p.getPumpNumber(), p.getDiscountPrice(), p.getBasePrice());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
