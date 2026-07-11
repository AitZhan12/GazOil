package kz.azs.web.dto;

public record AuthResponse(String token, String username, String stationName) {
}
