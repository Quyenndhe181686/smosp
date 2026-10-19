package com.sep490_g47.smosp.narrowspec.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class WeightConfigAuditResponse {
    private LocalDateTime changedAt;
    private String changedBy;
    private String note;
    
    private BigDecimal alphaBaseOld;
    private BigDecimal alphaBaseNew;
    
    private BigDecimal wGpaOld;
    private BigDecimal wGpaNew;
    
    private BigDecimal wSkillOld;
    private BigDecimal wSkillNew;
    
    private BigDecimal wIntOld;
    private BigDecimal wIntNew;
    private BigDecimal wSaccOld;
    private BigDecimal wSaccNew;
    private BigDecimal wSvolOld;
    private BigDecimal wSvolNew;
    private BigDecimal wJuniorOld;
    private BigDecimal wJuniorNew;
}
