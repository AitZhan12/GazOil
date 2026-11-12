package kz.azs.web.dto;

import java.time.OffsetDateTime;

public record AuditEventDto(
        Long id,
        String actorUsername,
        String action,
        String entityType,
        String entityId,
        String stationName,
        String operatorName,
        String details,
        OffsetDateTime occurredAt
) {}
