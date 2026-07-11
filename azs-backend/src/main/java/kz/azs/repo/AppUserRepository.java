package kz.azs.repo;

import kz.azs.domain.AppUser;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    @EntityGraph(attributePaths = {"station"})
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    @EntityGraph(attributePaths = {"station"})
    Optional<AppUser> findByApiToken(String apiToken);
}
