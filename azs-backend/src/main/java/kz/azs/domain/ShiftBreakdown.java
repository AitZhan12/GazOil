package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "shift_breakdown")
@Getter @Setter @NoArgsConstructor
public class ShiftBreakdown {

    @Id
    private Long shiftId;          // общий PK со сменой

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "shift_id")
    private Shift shift;

    @Column(name = "talony_liters", nullable = false, precision = 10, scale = 2)
    private BigDecimal talonyLiters = BigDecimal.ZERO;

    @Column(name = "card_liters", nullable = false, precision = 10, scale = 2)
    private BigDecimal cardLiters = BigDecimal.ZERO;

    @Column(name = "discount_liters", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountLiters = BigDecimal.ZERO;

    @Column(name = "discount_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountPrice;

    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "kaspi_qr", nullable = false, precision = 14, scale = 2)
    private BigDecimal kaspiQr = BigDecimal.ZERO;

    @Column(name = "kaspi_transfer", nullable = false, precision = 14, scale = 2)
    private BigDecimal kaspiTransfer = BigDecimal.ZERO;
}
