package kz.azs.web;

import kz.azs.service.OperatorService;
import kz.azs.web.dto.OperatorDto;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operators")
public class OperatorController {

    private final OperatorService service;

    public OperatorController(OperatorService service) {
        this.service = service;
    }

    @GetMapping
    public List<OperatorDto> list() {
        return service.list();
    }

    @PostMapping
    public OperatorDto create(@RequestBody OperatorDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public OperatorDto update(@PathVariable Long id, @RequestBody OperatorDto dto) {
        return service.update(id, dto);
    }
}
