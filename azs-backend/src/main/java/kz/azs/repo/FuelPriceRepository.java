package kz.azs.repo;

import kz.azs.domain.FuelPrice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FuelPriceRepository extends JpaRepository<FuelPrice, Short> {

    // Единственная строка цен лежит под id=1 (см. fuel_price.chk_fuel_price_single).
    default FuelPrice requireSingle() {
        return findById((short) 1)
                .orElseThrow(() -> new IllegalStateException("Цены топлива (fuel_price) не инициализированы"));
    }
}
