package kz.azs.web;

import kz.azs.service.GasDeliveryService;
import kz.azs.web.dto.GasDeliveryDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Журнал прихода газа (поставки). Бегущий остаток выводит фронт. */
@RestController
@RequestMapping("/api/deliveries")
public class GasDeliveryController {

    private final GasDeliveryService service;

    public GasDeliveryController(GasDeliveryService service) {
        this.service = service;
    }

    @GetMapping
    public List<GasDeliveryDto> list() {
        return service.list();
    }

    @PostMapping
    public GasDeliveryDto create(@RequestBody GasDeliveryDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public GasDeliveryDto update(@PathVariable Long id, @RequestBody GasDeliveryDto dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
