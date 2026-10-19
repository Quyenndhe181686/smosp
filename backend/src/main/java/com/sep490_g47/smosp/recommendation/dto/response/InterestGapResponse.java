package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterestGapResponse {
    private UUID id;
    private String label;
    private BigDecimal weight;
}
