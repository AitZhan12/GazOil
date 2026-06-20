package kz.azs.repo;

import kz.azs.domain.SalaryConfig;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SalaryConfigRepository extends JpaRepository<SalaryConfig, Long> {

    @EntityGraph(attributePaths = {"tiers"})
    Optional<SalaryConfig> findFirstByOrderByIdAsc();
}
