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

/** Общие цены 107/112 (singleton-строка). Снапшотятся в смену при её создании. */
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
    public FuelPrice requireCurrent() {
        return prices.findByStationId(auth.currentStation().getId())
                .orElseThrow(() -> new NotFoundException("Цены топлива не настроены"));
    }

    @Transactional(readOnly = true)
    public FuelPriceDto get() {
        return toDto(requireCurrent());
    }

    public FuelPriceDto update(FuelPriceDto dto) {
        FuelPrice p = requireCurrent();
        p.setDiscountPrice(nz(dto.discountPrice()));
        p.setBasePrice(nz(dto.basePrice()));
        p.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return toDto(prices.save(p));
    }

    private static FuelPriceDto toDto(FuelPrice p) {
        return new FuelPriceDto(p.getDiscountPrice(), p.getBasePrice());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
