package com.sep490_g47.smosp.account.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeleteReportRequest {
    @NotBlank(message = "Deleted reason cannot be empty")
    private String deletedReason;
}
