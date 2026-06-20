package kz.azs.repo;

import kz.azs.domain.Shift;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    @EntityGraph(attributePaths = {"operator", "acceptedBy", "readings", "breakdown"})
    List<Shift> findAllByOrderByStartedAtDesc();

    @EntityGraph(attributePaths = {"operator", "acceptedBy", "readings", "breakdown"})
    Optional<Shift> findWithDetailsById(Long id);
}
