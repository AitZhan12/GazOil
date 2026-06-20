package kz.azs.service;

import kz.azs.domain.BonusTier;
import kz.azs.domain.SalaryConfig;
import kz.azs.domain.Station;
import kz.azs.repo.SalaryConfigRepository;
import kz.azs.repo.StationRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.BonusTierDto;
import kz.azs.web.dto.SettingsDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

/** Чтение/запись конфига зарплаты и бонуса (singleton на станцию). */
@Service
@Transactional
public class SettingsService {

    private final SalaryConfigRepository configs;
    private final StationRepository stations;

    public SettingsService(SalaryConfigRepository configs, StationRepository stations) {
        this.configs = configs;
        this.stations = stations;
    }

    /** Доменный конфиг — нужен расчёту ЗП/бонуса в мапере. */
    @Transactional(readOnly = true)
    public SalaryConfig requireConfig() {
        return configs.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new NotFoundException("Настройки зарплаты не инициализированы"));
    }

    @Transactional(readOnly = true)
    public SettingsDto get() {
        return toDto(requireConfig());
    }

    public SettingsDto update(SettingsDto dto) {
        SalaryConfig config = configs.findFirstByOrderByIdAsc().orElseGet(() -> {
            SalaryConfig c = new SalaryConfig();
            c.setStation(defaultStation());
            return c;
        });

        config.setRateFull(nz(dto.rateFull()));
        config.setRateDay(nz(dto.rateDay()));
        config.setRateNight(nz(dto.rateNight()));
        config.setDefaultDiscountPrice(nz(dto.defaultDiscountPrice()));
        config.setDefaultBasePrice(nz(dto.defaultBasePrice()));

        // Полная замена таблицы ступеней. Чистим и сбрасываем в БД до вставки,
        // иначе новые строки упрутся в unique (config_id, threshold_liters).
        config.getTiers().clear();
        configs.saveAndFlush(config);

        if (dto.bonusTiers() != null) {
            dto.bonusTiers().stream()
                    .filter(t -> t.thresholdLiters() != null && t.bonusAmount() != null)
                    .sorted(Comparator.comparing(BonusTierDto::thresholdLiters))
                    .forEach(t -> {
                        BonusTier tier = new BonusTier();
                        tier.setThresholdLiters(nz(t.thresholdLiters()));
                        tier.setBonusAmount(nz(t.bonusAmount()));
                        config.addTier(tier);
                    });
        }
        return toDto(configs.save(config));
    }

    private SettingsDto toDto(SalaryConfig c) {
        List<BonusTierDto> tiers = c.getTiers().stream()
                .sorted(Comparator.comparing(BonusTier::getThresholdLiters))
                .map(t -> new BonusTierDto(t.getThresholdLiters(), t.getBonusAmount()))
                .toList();
        return new SettingsDto(
                c.getRateFull(), c.getRateDay(), c.getRateNight(),
                c.getDefaultDiscountPrice(), c.getDefaultBasePrice(), tiers);
    }

    private Station defaultStation() {
        return stations.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new NotFoundException("Станция по умолчанию не настроена"));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
