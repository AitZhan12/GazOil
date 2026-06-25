package kz.azs.web;

import kz.azs.service.TankResetService;
import kz.azs.web.dto.TankResetDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Журнал обнулений резервуара. Бегущий остаток выводит фронт. */
@RestController
@RequestMapping("/api/tank-resets")
public class TankResetController {

    private final TankResetService service;

    public TankResetController(TankResetService service) {
        this.service = service;
    }

    @GetMapping
    public List<TankResetDto> list() {
        return service.list();
    }

    @PostMapping
    public TankResetDto create(@RequestBody TankResetDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public TankResetDto update(@PathVariable Long id, @RequestBody TankResetDto dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
