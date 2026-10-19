package com.sep490_g47.smosp.account.dto.response;

import com.sep490_g47.smosp.account.enums.ReportEntityType;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import lombok.Data;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.util.UUID;

@Data
@SuperBuilder
public class ErrorReportResponse extends BaseResponse {
    private UUID id;
    private UUID reporterId;
    private ReportEntityType entityType;
    private UUID entityId;
    /** Tên/mã nội dung bị báo lỗi — xem ContentErrorReport.entityName. */
    private String entityName;
    private String entityCode;
    private String description;
    private ReportStatus status;
    private String processingNote;
    private String deletedReason;
    private UUID deletedBy;
    private UUID assignedToId;
    private String assignedToName;
}
