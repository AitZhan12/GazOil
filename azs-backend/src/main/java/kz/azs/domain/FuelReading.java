package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;

@Entity
@Table(name = "fuel_reading")
@Getter @Setter @NoArgsConstructor
public class FuelReading {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @Column(name = "pump_number", nullable = false)
    private Short pumpNumber;

    @Column(name = "reading_start", nullable = false, precision = 12, scale = 2)
    private BigDecimal readingStart;

    @Column(name = "reading_end", nullable = false, precision = 12, scale = 2)
    private BigDecimal readingEnd;

    @Column(name = "discount_liters", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountLiters = BigDecimal.ZERO;

    @Column(name = "discount_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountPrice = BigDecimal.ZERO;

    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice = BigDecimal.ZERO;

    // Считается в БД (generated stored). Сюда только читаем — Hibernate
    // перечитывает значение после insert/update, никогда его не пишет.
    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "realization", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal realization;
}
