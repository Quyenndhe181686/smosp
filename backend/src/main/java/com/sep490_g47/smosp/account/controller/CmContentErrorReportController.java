package com.sep490_g47.smosp.account.controller;

import com.sep490_g47.smosp.account.dto.response.ErrorReportResponse;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import com.sep490_g47.smosp.account.service.ContentErrorReportService;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cm/content-error-reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('CONTENT_MANAGER')")
public class CmContentErrorReportController {

    private final ContentErrorReportService reportService;

    @GetMapping
    public ResponseEntity<List<ErrorReportResponse>> getAllReports(
            @RequestParam(required = false) ReportStatus status) {
        return ResponseEntity.ok(reportService.getAllReports(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ErrorReportResponse> getReportById(@PathVariable UUID id) {
        return ResponseEntity.ok(reportService.getReportByIdForCm(id));
    }

    @PatchMapping("/{id}/process")
    public ResponseEntity<ErrorReportResponse> processReport(
            @PathVariable UUID id,
            @Valid @RequestBody com.sep490_g47.smosp.account.dto.request.ProcessReportRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(reportService.processReport(id, request, userDetails.getUserId()));
    }
}
