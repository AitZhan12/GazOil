package kz.azs.repo;

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
    Optional<Shift> findWithDetailsById(Long id);

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
}
