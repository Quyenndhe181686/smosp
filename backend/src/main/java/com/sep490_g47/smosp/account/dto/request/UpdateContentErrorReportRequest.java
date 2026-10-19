package com.sep490_g47.smosp.account.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateContentErrorReportRequest {

    @NotBlank(message = "Description cannot be empty")
    @jakarta.validation.constraints.Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;
}
