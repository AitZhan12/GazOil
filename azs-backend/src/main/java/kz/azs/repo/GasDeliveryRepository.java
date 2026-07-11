package kz.azs.repo;

import kz.azs.domain.GasDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GasDeliveryRepository extends JpaRepository<GasDelivery, Long> {

    List<GasDelivery> findAllByOrderByDeliveredAtAsc();

    List<GasDelivery> findAllByStationIdOrderByDeliveredAtAsc(Long stationId);

    java.util.Optional<GasDelivery> findByIdAndStationId(Long id, Long stationId);

    boolean existsByIdAndStationId(Long id, Long stationId);
}
