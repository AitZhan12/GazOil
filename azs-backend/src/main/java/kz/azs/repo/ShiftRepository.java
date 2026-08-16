package kz.azs.repo;

import kz.azs.domain.FuelReading;
import kz.azs.domain.Shift;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    @EntityGraph(attributePaths = {"operator", "acceptedBy", "readings", "breakdown"})
    List<Shift> findAllByOrderByStartedAtDesc();

    @EntityGraph(attributePaths = {"operator", "acceptedBy", "readings", "breakdown"})
    List<Shift> findAllByStationIdOrderByStartedAtDesc(Long stationId);

    @EntityGraph(attributePaths = {"operator", "acceptedBy", "readings", "breakdown"})
    Optional<Shift> findWithDetailsById(Long id);

    @EntityGraph(attributePaths = {"operator", "acceptedBy", "readings", "breakdown"})
    Optional<Shift> findWithDetailsByIdAndStationId(Long id, Long stationId);

    boolean existsByIdAndStationId(Long id, Long stationId);

    /**
     * Смены, чей интервал пересекается с [start, end). Касание встык
     * (конец одной == начало другой) пересечением НЕ считается.
     * excludeId исключает саму редактируемую смену (на создании — null).
     */
    @Query("""
            select s from Shift s
            where s.startedAt < :end and s.endedAt > :start
              and (:excludeId is null or s.id <> :excludeId)
            order by s.startedAt
            """)
    List<Shift> findOverlapping(@Param("start") OffsetDateTime start,
                                @Param("end") OffsetDateTime end,
                                @Param("excludeId") Long excludeId);

    /**
     * Последнее показание конкретной колонки до начала смены. При редактировании
     * исключаем саму смену, чтобы она не сравнивалась со своими старыми данными.
     */
    @Query("""
            select r from FuelReading r
            join fetch r.shift s
            where s.station.id = :stationId
              and r.pumpNumber = :pumpNumber
              and s.endedAt <= :startedAt
              and (:excludeId is null or s.id <> :excludeId)
            order by s.endedAt desc, s.id desc
            """)
    List<FuelReading> findPreviousReading(@Param("stationId") Long stationId,
                                          @Param("pumpNumber") short pumpNumber,
                                          @Param("startedAt") OffsetDateTime startedAt,
                                          @Param("excludeId") Long excludeId,
                                          org.springframework.data.domain.Pageable pageable);
}
