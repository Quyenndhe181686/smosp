package com.sep490_g47.smosp.account.dto.request;

import com.sep490_g47.smosp.account.enums.ReportEntityType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ContentErrorReportRequest {

    @NotNull(message = "Entity Type cannot be null")
    private ReportEntityType entityType;

    @NotNull(message = "Entity ID cannot be null")
    private UUID entityId;

    @NotBlank(message = "Description cannot be empty")
    @jakarta.validation.constraints.Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;
}
