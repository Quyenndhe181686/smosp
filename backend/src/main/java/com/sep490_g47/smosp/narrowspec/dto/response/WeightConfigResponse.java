package com.sep490_g47.smosp.narrowspec.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class WeightConfigResponse {
    private UUID narrowSpecId;
    private String narrowSpecName;
    private BigDecimal alphaBase;
    private BigDecimal wGpa;
    private BigDecimal wSkill;
    private BigDecimal wInt;
    private BigDecimal wSacc;
    private BigDecimal wSvol;
    private BigDecimal wJunior;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
