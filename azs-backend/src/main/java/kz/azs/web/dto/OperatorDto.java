package kz.azs.web.dto;

/** Совпадает по форме с интерфейсом Operator на фронте. */
public record OperatorDto(
        String id,
        String name,
        boolean active
) {}
