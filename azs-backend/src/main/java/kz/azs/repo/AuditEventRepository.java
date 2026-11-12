package kz.azs.repo;

import kz.azs.domain.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    List<AuditEvent> findTop500ByStationNameOrderByOccurredAtDesc(String stationName);
}
