package kz.azs.web.dto;

import java.util.List;

public record AuthResponse(
        String token,
        String username,
        Long stationId,
        String stationName,
        int pumpCount,
        List<StationInfo> stations,
        String role,
        Long operatorId,
        String operatorName
) {
}
