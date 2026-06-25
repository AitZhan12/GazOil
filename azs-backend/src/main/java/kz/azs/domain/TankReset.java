package kz.azs.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Обнуление резервуара: момент, когда остаток газа сброшен в ноль (газ закончился).
 * Накопленная погрешность замеров списывается; бегущий остаток фронт считает
 * заново от нуля после этой точки.
 */
@Entity
@Table(name = "tank_reset")
@Getter @Setter @NoArgsConstructor
public class TankReset {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @Column(name = "reset_at", nullable = false)
    private OffsetDateTime resetAt;

    @Column(name = "note")
    private String note;

    /** Показания счётчиков колонок на момент обнуления. */
    @OneToMany(mappedBy = "tankReset", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("pumpNumber asc")
    private List<TankResetReading> readings = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** Держит обе стороны связи в синхроне. */
    public void addReading(TankResetReading r) {
        readings.add(r);
        r.setTankReset(this);
    }
}
