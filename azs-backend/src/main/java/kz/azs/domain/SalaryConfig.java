package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Редактируемые владельцем настройки зарплаты и бонуса (один конфиг на станцию).
 * Ставки — по типу смены, бонус — таблицей ступеней {@link BonusTier}.
 */
@Entity
@Table(name = "salary_config")
@Getter @Setter @NoArgsConstructor
public class SalaryConfig {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @Column(name = "rate_full", nullable = false, precision = 12, scale = 2)
    private BigDecimal rateFull = BigDecimal.ZERO;

    @Column(name = "rate_day", nullable = false, precision = 12, scale = 2)
    private BigDecimal rateDay = BigDecimal.ZERO;

    @Column(name = "rate_night", nullable = false, precision = 12, scale = 2)
    private BigDecimal rateNight = BigDecimal.ZERO;

    @Column(name = "default_discount_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal defaultDiscountPrice = BigDecimal.ZERO;

    @Column(name = "default_base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal defaultBasePrice = BigDecimal.ZERO;

    /** Остаток газа в резервуаре на старте учёта — точка отсчёта бегущего остатка. */
    @Column(name = "initial_stock_liters", nullable = false, precision = 14, scale = 2)
    private BigDecimal initialStockLiters = BigDecimal.ZERO;

    /** Объём резервуара (0 = контроль перелива выключен). */
    @Column(name = "tank_capacity_liters", nullable = false, precision = 14, scale = 2)
    private BigDecimal tankCapacityLiters = BigDecimal.ZERO;

    /** Допустимая погрешность замера при заливке (л) — в её пределах минус/перелив не считаем проблемой. */
    @Column(name = "measurement_tolerance_liters", nullable = false, precision = 14, scale = 2)
    private BigDecimal measurementToleranceLiters = BigDecimal.ZERO;

    @OneToMany(mappedBy = "config", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("thresholdLiters asc")
    private List<BonusTier> tiers = new ArrayList<>();

    /** Держит обе стороны связи в синхроне. */
    public void addTier(BonusTier t) {
        tiers.add(t);
        t.setConfig(this);
    }
}
