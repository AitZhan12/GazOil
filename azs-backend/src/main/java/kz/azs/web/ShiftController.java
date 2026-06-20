package kz.azs.web;

import kz.azs.service.ShiftService;
import kz.azs.web.dto.ShiftDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shifts")
public class ShiftController {

    private final ShiftService service;

    public ShiftController(ShiftService service) {
        this.service = service;
    }

    @GetMapping
    public List<ShiftDto> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public ShiftDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public ShiftDto create(@RequestBody ShiftDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public ShiftDto update(@PathVariable Long id, @RequestBody ShiftDto dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
