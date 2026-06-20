package kz.azs.web;

import kz.azs.service.SettingsService;
import kz.azs.web.dto.SettingsDto;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping
    public SettingsDto get() {
        return service.get();
    }

    @PutMapping
    public SettingsDto update(@RequestBody SettingsDto dto) {
        return service.update(dto);
    }
}
