package com.sep490_g47.smosp.interest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class InterestOptionRequest {
    @NotNull(message = "specializationId is required")
    private UUID specializationId;

    @NotBlank(message = "label is required")
    private String label;
}
