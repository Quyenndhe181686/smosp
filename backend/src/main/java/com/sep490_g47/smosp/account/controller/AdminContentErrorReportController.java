package com.sep490_g47.smosp.account.controller;

import com.sep490_g47.smosp.account.dto.request.DeleteReportRequest;
import com.sep490_g47.smosp.account.service.ContentErrorReportService;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.sep490_g47.smosp.account.dto.response.ErrorReportResponse;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/content-error-reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminContentErrorReportController {

    private final ContentErrorReportService reportService;

    @GetMapping
    public ResponseEntity<List<ErrorReportResponse>> getAllReports(
            @RequestParam(required = false) ReportStatus status) {
        return ResponseEntity.ok(reportService.getAllReports(status));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDeleteReport(
            @PathVariable UUID id,
            @Valid @RequestBody DeleteReportRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        reportService.softDeleteReport(id, request, userDetails.getUserId());
        return ResponseEntity.noContent().build();
    }
}
