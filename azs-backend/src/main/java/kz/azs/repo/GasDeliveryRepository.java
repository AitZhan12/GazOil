package kz.azs.repo;

import kz.azs.domain.GasDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GasDeliveryRepository extends JpaRepository<GasDelivery, Long> {

    List<GasDelivery> findAllByOrderByDeliveredAtAsc();
}
