package com.sep490_g47.smosp.account.controller;

import com.sep490_g47.smosp.account.service.ContentErrorReportService;
import com.sep490_g47.smosp.account.dto.request.ContentErrorReportRequest;
import com.sep490_g47.smosp.account.dto.response.ErrorReportResponse;
import com.sep490_g47.smosp.account.dto.request.UpdateContentErrorReportRequest;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/content-error-reports")
@RequiredArgsConstructor
public class ContentErrorReportController {

    private final ContentErrorReportService reportService;

    @PostMapping
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ErrorReportResponse> createReport(
            @Valid @RequestBody ContentErrorReportRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        ErrorReportResponse response = reportService.createReport(userDetails.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<ErrorReportResponse>> getMyReports(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(reportService.getMyReports(userDetails.getUserId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ErrorReportResponse> getReportById(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(reportService.getReportById(userDetails.getUserId(), id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ErrorReportResponse> updateReport(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateContentErrorReportRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(reportService.updateReport(userDetails.getUserId(), id, request));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Void> cancelReport(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        reportService.cancelReport(userDetails.getUserId(), id);
        return ResponseEntity.noContent().build();
    }
}
