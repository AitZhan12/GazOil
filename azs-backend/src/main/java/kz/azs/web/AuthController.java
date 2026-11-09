package kz.azs.web;

import kz.azs.service.AuthService;
import kz.azs.web.dto.AuthResponse;
import kz.azs.web.dto.LoginRequest;
import kz.azs.web.dto.StationInfo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest dto) {
        return service.login(dto);
    }

    @GetMapping("/stations")
    public List<StationInfo> stations() {
        return service.availableStations();
    }
}
