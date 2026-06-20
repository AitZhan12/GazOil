package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shift")
@Getter @Setter @NoArgsConstructor
public class Shift {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operator_id", nullable = false)
    private Operator operator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accepted_by_operator_id")
    private Operator acceptedBy;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "ended_at", nullable = false)
    private OffsetDateTime endedAt;

    /** Тип смены: full (сутки) | day (день) | night (ночь). Задаёт ставку ЗП. */
    @Column(name = "shift_type", nullable = false, length = 8)
    private String shiftType = "full";

    @Column(columnDefinition = "text")
    private String note;

    @OneToMany(mappedBy = "shift", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FuelReading> readings = new ArrayList<>();

    @OneToOne(mappedBy = "shift", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private ShiftBreakdown breakdown;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** Держит обе стороны связи в синхроне. */
    public void addReading(FuelReading r) {
        readings.add(r);
        r.setShift(this);
    }

    /** Удобный сеттер для 1:1, чтобы не забыть обратную ссылку. */
    public void setBreakdown(ShiftBreakdown b) {
        this.breakdown = b;
        if (b != null) {
            b.setShift(this);
        }
    }
}
