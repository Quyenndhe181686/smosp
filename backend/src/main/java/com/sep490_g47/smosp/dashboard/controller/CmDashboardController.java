package com.sep490_g47.smosp.dashboard.controller;

import com.sep490_g47.smosp.dashboard.dto.response.CmDashboardResponse;
import com.sep490_g47.smosp.dashboard.service.CmDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cm/dashboard")
@PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
@RequiredArgsConstructor
public class CmDashboardController {

    private final CmDashboardService dashboardService;

    /** Toàn bộ số liệu dashboard trong một lần gọi. */
    @GetMapping("/overview")
    public ResponseEntity<CmDashboardResponse> getOverview() {
        return ResponseEntity.ok(dashboardService.getOverview());
    }
}
