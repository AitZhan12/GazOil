package kz.azs.web;

import kz.azs.service.FuelPriceService;
import kz.azs.web.dto.FuelPriceDto;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Общие цены 107/112. Изменение влияет на смены, создаваемые ПОСЛЕ правки. */
@RestController
@RequestMapping("/api/config/fuel-price")
public class FuelPriceController {

    private final FuelPriceService service;

    public FuelPriceController(FuelPriceService service) {
        this.service = service;
    }

    @GetMapping
    public List<FuelPriceDto> get() {
        return service.get();
    }

    @PutMapping
    public List<FuelPriceDto> update(@RequestBody List<FuelPriceDto> dto) {
        return service.update(dto);
    }
}
