package com.sep490_g47.smosp.account.dto;

import com.sep490_g47.smosp.account.enums.ReportStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ProcessReportRequestDTO {

    @NotNull(message = "Status cannot be null")
    private ReportStatus status; // PENDING, IN_PROGRESS, RESOLVED, DISMISSED

    private String processingNote;// Ghi chú (bắt buộc nếu là RESOLVED/DISMISSED)
}
