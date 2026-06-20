package kz.azs.service;

import kz.azs.domain.Operator;
import kz.azs.domain.Station;
import kz.azs.repo.OperatorRepository;
import kz.azs.repo.StationRepository;
import kz.azs.web.NotFoundException;
import kz.azs.web.dto.OperatorDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class OperatorService {

    private final OperatorRepository operators;
    private final StationRepository stations;
    private final AzsMapper mapper;

    public OperatorService(OperatorRepository operators, StationRepository stations, AzsMapper mapper) {
        this.operators = operators;
        this.stations = stations;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<OperatorDto> list() {
        return operators.findAllByOrderByIdAsc().stream().map(mapper::toDto).toList();
    }

    public OperatorDto create(OperatorDto dto) {
        Operator op = new Operator();
        op.setStation(defaultStation());
        op.setFullName(dto.name());
        op.setActive(true);
        return mapper.toDto(operators.save(op));
    }

    public OperatorDto update(Long id, OperatorDto dto) {
        Operator op = operators.findById(id)
                .orElseThrow(() -> new NotFoundException("Оператор не найден: " + id));
        op.setFullName(dto.name());
        op.setActive(dto.active());
        return mapper.toDto(operators.save(op));
    }

    private Station defaultStation() {
        return stations.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new NotFoundException("Станция по умолчанию не настроена"));
    }
}
