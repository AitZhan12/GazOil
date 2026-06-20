package kz.azs.repo;

import kz.azs.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, Long> {

    Optional<Station> findFirstByOrderByIdAsc();
}
