package com.sep490_g47.smosp.major.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StatusUpdateRequest {
    @NotNull(message = "isActive is required")
    private Boolean isActive;
}
