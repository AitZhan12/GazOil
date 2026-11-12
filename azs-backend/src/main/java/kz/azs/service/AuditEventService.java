package kz.azs.service;

import kz.azs.domain.AuditEvent;
import kz.azs.domain.Operator;
import kz.azs.domain.Shift;
import kz.azs.repo.AuditEventRepository;
import kz.azs.web.dto.AuditEventDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class AuditEventService {
    private final AuditEventRepository events;
    private final AuthService auth;

    public AuditEventService(AuditEventRepository events, AuthService auth) {
        this.events = events;
        this.auth = auth;
    }

    public void shift(String action, Shift shift, String details) {
        AuditEvent event = new AuditEvent();
        event.setActorUsername(auth.currentUser().getUsername());
        event.setAction(action);
        event.setEntityType("SHIFT");
        event.setEntityId(shift.getId() == null ? null : String.valueOf(shift.getId()));
        event.setStationName(shift.getStation().getName());
        Operator operator = shift.getOperator();
        event.setOperatorName(operator == null ? null : operator.getFullName());
        event.setDetails(details);
        events.save(event);
    }

    @Transactional(readOnly = true)
    public List<AuditEventDto> list() {
        auth.requireAdmin();
        return events.findTop500ByStationNameOrderByOccurredAtDesc(auth.currentStation().getName()).stream()
                .map(e -> new AuditEventDto(e.getId(), e.getActorUsername(), e.getAction(),
                        e.getEntityType(), e.getEntityId(), e.getStationName(), e.getOperatorName(),
                        e.getDetails(), e.getOccurredAt()))
                .toList();
    }
}
