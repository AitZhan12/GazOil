package kz.azs.repo;

import kz.azs.domain.TankReset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TankResetRepository extends JpaRepository<TankReset, Long> {

    List<TankReset> findAllByOrderByResetAtAsc();
}
