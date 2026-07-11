package kz.azs.service;

import kz.azs.domain.Operator;
import kz.azs.domain.Station;
import kz.azs.repo.OperatorRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.OperatorDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class OperatorService {

    private final OperatorRepository operators;
    private final AzsMapper mapper;
    private final AuthService auth;

    public OperatorService(OperatorRepository operators, AzsMapper mapper, AuthService auth) {
        this.operators = operators;
        this.mapper = mapper;
        this.auth = auth;
    }

    @Transactional(readOnly = true)
    public List<OperatorDto> list() {
        return operators.findAllByStationIdOrderByIdAsc(auth.currentStation().getId()).stream()
                .map(mapper::toDto).toList();
    }

    public OperatorDto create(OperatorDto dto) {
        Operator op = new Operator();
        op.setStation(auth.currentStation());
        op.setFullName(dto.name());
        op.setActive(true);
        return mapper.toDto(operators.save(op));
    }

    public OperatorDto update(Long id, OperatorDto dto) {
        Operator op = operators.findByIdAndStationId(id, auth.currentStation().getId())
                .orElseThrow(() -> new NotFoundException("Оператор не найден: " + id));
        op.setFullName(dto.name());
        op.setActive(dto.active());
        return mapper.toDto(operators.save(op));
    }
}
