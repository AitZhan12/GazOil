package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Приход газа (поставка в резервуар). Бегущий остаток нигде не хранится —
 * фронт считает его по поставкам, реализации смен и начальному остатку.
 */
@Entity
@Table(name = "gas_delivery")
@Getter @Setter @NoArgsConstructor
public class GasDelivery {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @Column(name = "delivered_at", nullable = false)
    private OffsetDateTime deliveredAt;

    @Column(name = "liters", nullable = false, precision = 14, scale = 2)
    private BigDecimal liters = BigDecimal.ZERO;

    @Column(name = "supplier")
    private String supplier;

    @Column(name = "note")
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
