package com.sep490_g47.smosp.tagmap.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class TagMapEntryRequest {

    @NotBlank(message = "sourceType is required")
    private String sourceType;

    @NotNull(message = "sourceId is required")
    private UUID sourceId;

    @NotBlank(message = "mappingType is required")
    @jakarta.validation.constraints.Pattern(regexp = "^(DIRECT|SHARED)$", message = "mappingType must be DIRECT or SHARED")
    private String mappingType;

    @NotNull(message = "weight is required")
    @DecimalMin(value = "0.1", inclusive = true, message = "weight must be at least 0.1")
    @DecimalMax(value = "10.0", inclusive = true, message = "weight must not exceed 10.0")
    private BigDecimal weight;

}
