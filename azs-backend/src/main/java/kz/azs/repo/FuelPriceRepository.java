package kz.azs.repo;

import kz.azs.domain.FuelPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FuelPriceRepository extends JpaRepository<FuelPrice, Short> {

    List<FuelPrice> findAllByStationIdOrderByPumpNumber(Long stationId);
}
