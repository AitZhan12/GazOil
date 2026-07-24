package kz.azs.web;

import kz.azs.service.WaterRecordService;
import kz.azs.web.dto.WaterRecordDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/water-records")
public class WaterRecordController {
    private final WaterRecordService service;
    public WaterRecordController(WaterRecordService service) { this.service = service; }
    @GetMapping public List<WaterRecordDto> list() { return service.list(); }
    @PostMapping public WaterRecordDto create(@RequestBody WaterRecordDto dto) { return service.create(dto); }
    @PutMapping("/{id}") public WaterRecordDto update(@PathVariable Long id, @RequestBody WaterRecordDto dto) { return service.update(id, dto); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable Long id) { service.delete(id); }
}
