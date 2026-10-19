package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationItemResponse {
    private UUID id;
    private UUID narrowSpecId;
    private String narrowSpecCode;
    private String narrowSpecName;
    private BigDecimal finalScore;
    private Integer rank;
    private Boolean fallbackApplied;
}
