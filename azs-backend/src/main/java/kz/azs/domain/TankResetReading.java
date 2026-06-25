package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Показание счётчика одной колонки на момент обнуления резервуара. */
@Entity
@Table(name = "tank_reset_reading")
@Getter @Setter @NoArgsConstructor
public class TankResetReading {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tank_reset_id", nullable = false)
    private TankReset tankReset;

    @Column(name = "pump_number", nullable = false)
    private Short pumpNumber;

    @Column(name = "reading", nullable = false, precision = 12, scale = 2)
    private BigDecimal reading = BigDecimal.ZERO;
}
