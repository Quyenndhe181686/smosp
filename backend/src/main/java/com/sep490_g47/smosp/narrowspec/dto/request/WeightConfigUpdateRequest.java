package com.sep490_g47.smosp.narrowspec.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class WeightConfigUpdateRequest {
    @NotNull(message = "alphaBase is required")
    private BigDecimal alphaBase;
    @NotNull(message = "wGpa is required")
    private BigDecimal wGpa;
    @NotNull(message = "wSkill is required")
    private BigDecimal wSkill;
    @NotNull(message = "wInt is required")
    private BigDecimal wInt;
    @NotNull(message = "wSacc is required")
    private BigDecimal wSacc;
    @NotNull(message = "wSvol is required")
    private BigDecimal wSvol;
    @NotNull(message = "wJunior is required")
    private BigDecimal wJunior;
    
    private String note;
}
