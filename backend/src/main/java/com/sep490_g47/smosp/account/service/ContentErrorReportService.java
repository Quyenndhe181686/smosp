package com.sep490_g47.smosp.account.service;

import com.sep490_g47.smosp.account.dto.request.ContentErrorReportRequest;
import com.sep490_g47.smosp.account.dto.response.ErrorReportResponse;
import com.sep490_g47.smosp.account.dto.request.UpdateContentErrorReportRequest;

import java.util.List;
import java.util.UUID;

public interface ContentErrorReportService {
    ErrorReportResponse createReport(UUID reporterId, ContentErrorReportRequest request);
    List<ErrorReportResponse> getMyReports(UUID reporterId);
    ErrorReportResponse getReportById(UUID reporterId, UUID reportId);
    ErrorReportResponse updateReport(UUID reporterId, UUID reportId, UpdateContentErrorReportRequest request);
    void cancelReport(UUID reporterId, UUID reportId);

    // CM methods
    List<ErrorReportResponse> getAllReports(com.sep490_g47.smosp.account.enums.ReportStatus status);
    ErrorReportResponse getReportByIdForCm(UUID reportId);
    ErrorReportResponse processReport(UUID reportId, com.sep490_g47.smosp.account.dto.request.ProcessReportRequest request, UUID actingCmId);

    /** Job nhắc hạn xử lý — quét report PENDING/IN_PROGRESS quá hạn, trả về số notification đã gửi. */
    int remindOverdueReports();

    // Admin methods
    void softDeleteReport(UUID reportId, com.sep490_g47.smosp.account.dto.request.DeleteReportRequest request, UUID adminId);
}
