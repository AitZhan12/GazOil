package kz.azs.web.dto;

import java.math.BigDecimal;

public record WaterRecordDto(
        String id,
        String operatorId,
        String date,
        String time,
        BigDecimal receivedQuantity,
        BigDecimal deliveryQuantity,
        BigDecimal soldQuantity,
        BigDecimal balanceQuantity
) {}
