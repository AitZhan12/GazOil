package kz.azs.web;

import kz.azs.service.FuelPriceService;
import kz.azs.web.dto.FuelPriceDto;
import org.springframework.web.bind.annotation.*;

/** Общие цены 107/112. Изменение влияет на смены, создаваемые ПОСЛЕ правки. */
@RestController
@RequestMapping("/api/config/fuel-price")
public class FuelPriceController {

    private final FuelPriceService service;

    public FuelPriceController(FuelPriceService service) {
        this.service = service;
    }

    @GetMapping
    public FuelPriceDto get() {
        return service.get();
    }

    @PutMapping
    public FuelPriceDto update(@RequestBody FuelPriceDto dto) {
        return service.update(dto);
    }
}
