package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Общие цены 107/112 (одна строка, id=1). При создании смены снапшотятся в её
 * {@link ShiftBreakdown}, чтобы прошлые смены не «поехали» при изменении цены.
 */
@Entity
@Table(name = "fuel_price")
@Getter @Setter @NoArgsConstructor
public class FuelPrice {

    @Id
    private Short id = 1;

    @Column(name = "discount_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountPrice = BigDecimal.ZERO;

    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice = BigDecimal.ZERO;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
