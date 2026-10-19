package com.sep490_g47.smosp.crawler.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CurrentTrendingWeightResponse {
    private UUID narrowSpecId;
    private String narrowSpecCode;
    private String narrowSpecName;
    private BigDecimal currentTw;
}
