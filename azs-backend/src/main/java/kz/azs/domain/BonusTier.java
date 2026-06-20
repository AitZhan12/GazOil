package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Одна ступень бонуса: «объём ≥ планки → бонус». */
@Entity
@Table(name = "bonus_tier")
@Getter @Setter @NoArgsConstructor
public class BonusTier {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "config_id", nullable = false)
    private SalaryConfig config;

    @Column(name = "threshold_liters", nullable = false, precision = 12, scale = 2)
    private BigDecimal thresholdLiters;

    @Column(name = "bonus_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal bonusAmount;
}
