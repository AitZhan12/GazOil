package kz.azs.web;

import kz.azs.service.AuditEventService;
import kz.azs.web.dto.AuditEventDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/audit-events")
public class AuditEventController {
    private final AuditEventService service;

    public AuditEventController(AuditEventService service) {
        this.service = service;
    }

    @GetMapping
    public List<AuditEventDto> list() {
        return service.list();
    }
}
