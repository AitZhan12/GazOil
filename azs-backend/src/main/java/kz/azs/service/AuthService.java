package kz.azs.service;

import jakarta.servlet.http.HttpServletRequest;
import kz.azs.domain.AppUser;
import kz.azs.domain.Station;
import kz.azs.repo.AppUserRepository;
import kz.azs.web.UnauthorizedException;
import kz.azs.web.dto.AuthResponse;
import kz.azs.web.dto.LoginRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Service
@Transactional
public class AuthService {

    private static final String TOKEN_HEADER = "X-Auth-Token";

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
        return currentUser().getStation();
    }

    private static AuthResponse toResponse(AppUser user) {
        return new AuthResponse(user.getApiToken(), user.getUsername(), user.getStation().getName());
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
