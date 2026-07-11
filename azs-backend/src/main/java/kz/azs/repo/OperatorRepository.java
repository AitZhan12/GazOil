package kz.azs.repo;

import kz.azs.domain.Operator;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OperatorRepository extends JpaRepository<Operator, Long> {

    List<Operator> findAllByOrderByIdAsc();

    List<Operator> findAllByStationIdOrderByIdAsc(Long stationId);

    java.util.Optional<Operator> findByIdAndStationId(Long id, Long stationId);
}
