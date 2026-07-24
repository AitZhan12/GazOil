package kz.azs.repo;

import kz.azs.domain.WaterRecord;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WaterRecordRepository extends JpaRepository<WaterRecord, Long> {
    @EntityGraph(attributePaths = "operator")
    List<WaterRecord> findAllByStationIdOrderByRecordedAtDesc(Long stationId);

    @EntityGraph(attributePaths = "operator")
    Optional<WaterRecord> findByIdAndStationId(Long id, Long stationId);
}
