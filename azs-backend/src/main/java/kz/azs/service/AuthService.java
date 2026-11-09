package kz.azs.service;

import jakarta.servlet.http.HttpServletRequest;
import kz.azs.domain.AppUser;
import kz.azs.domain.Station;
import kz.azs.repo.AppUserRepository;
import kz.azs.web.UnauthorizedException;
import kz.azs.web.ForbiddenException;
import kz.azs.web.dto.AuthResponse;
import kz.azs.web.dto.LoginRequest;
import kz.azs.web.dto.StationInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional
public class AuthService {

    private static final String TOKEN_HEADER = "X-Auth-Token";
    private static final String STATION_HEADER = "X-Station-Id";

    private final AppUserRepository users;
    private final HttpServletRequest request;

    public AuthService(AppUserRepository users, HttpServletRequest request) {
        this.users = users;
        this.request = request;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest dto) {
        String username = dto.username() != null ? dto.username().trim() : "";
        AppUser user = users.findByUsernameIgnoreCase(username)
                .filter(AppUser::isActive)
                .orElseThrow(() -> new UnauthorizedException("Неверный логин или пароль"));
        if (!hash(user.getPasswordSalt(), dto.password()).equals(user.getPasswordHash())) {
            throw new UnauthorizedException("Неверный логин или пароль");
        }
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public AppUser currentUser() {
        String token = request.getHeader(TOKEN_HEADER);
        if (token == null || token.isBlank()) {
            throw new UnauthorizedException("Требуется вход");
        }
        return users.findByApiToken(token.trim())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new UnauthorizedException("Сессия недействительна"));
    }

    @Transactional(readOnly = true)
    public Station currentStation() {
        AppUser user = currentUser();
        String requested = request.getHeader(STATION_HEADER);
        if (requested == null || requested.isBlank()) {
            return user.getStation();
        }

        long stationId;
        try {
            stationId = Long.parseLong(requested.trim());
        } catch (NumberFormatException e) {
            throw new UnauthorizedException("Некорректная выбранная заправка");
        }
        return user.getStations().stream()
                .filter(station -> station.getId().equals(stationId))
                .findFirst()
                .orElseThrow(() -> new UnauthorizedException("Нет доступа к выбранной заправке"));
    }

    public boolean isAdmin() {
        return "ADMIN".equals(currentUser().getRole());
    }

    public void requireAdmin() {
        if (!isAdmin()) throw new ForbiddenException("Недостаточно прав");
    }

    public AppUser currentOperatorUser() {
        AppUser user = currentUser();
        if (!"OPERATOR".equals(user.getRole()) || user.getOperator() == null) {
            throw new ForbiddenException("Аккаунт не является операторским");
        }
        return user;
    }

    @Transactional(readOnly = true)
    public List<StationInfo> availableStations() {
        return currentUser().getStations().stream()
                .sorted(Comparator.comparing(Station::getId))
                .map(station -> new StationInfo(
                        station.getId(), station.getName(), station.getPumpCount()))
                .toList();
    }

    private static AuthResponse toResponse(AppUser user) {
        Station station = user.getStation();
        List<StationInfo> stations = user.getStations().stream()
                .sorted(Comparator.comparing(Station::getId))
                .map(s -> new StationInfo(s.getId(), s.getName(), s.getPumpCount()))
                .toList();
        return new AuthResponse(
                user.getApiToken(), user.getUsername(), station.getId(), station.getName(),
                station.getPumpCount(), stations, user.getRole(),
                user.getOperator() != null ? user.getOperator().getId() : null,
                user.getOperator() != null ? user.getOperator().getFullName() : null);
    }

    private static String hash(String salt, String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest((salt + ":" + (password != null ? password : "")).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 недоступен", e);
        }
    }
}
