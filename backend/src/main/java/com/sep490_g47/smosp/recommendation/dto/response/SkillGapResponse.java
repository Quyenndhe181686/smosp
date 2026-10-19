package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillGapResponse {
    private UUID id;
    private String name;
    private BigDecimal weight;
    private Boolean studentHas;
}
