package com.sep490_g47.smosp.narrowspec.controller;

import com.sep490_g47.smosp.narrowspec.dto.request.WeightConfigUpdateRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.WeightConfigAuditResponse;
import com.sep490_g47.smosp.narrowspec.dto.response.WeightConfigResponse;
import com.sep490_g47.smosp.narrowspec.service.NarrowSpecWeightConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/cm/narrow-specs")
@RequiredArgsConstructor
public class NarrowSpecWeightConfigController {

    private final NarrowSpecWeightConfigService weightConfigService;

    @GetMapping("/{narrowSpecId}/weight-config")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
    public ResponseEntity<WeightConfigResponse> getWeightConfig(@PathVariable UUID narrowSpecId) {
        return ResponseEntity.ok(weightConfigService.getWeightConfig(narrowSpecId));
    }

    @PutMapping("/{narrowSpecId}/weight-config")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
    public ResponseEntity<WeightConfigResponse> updateWeightConfig(
            @PathVariable UUID narrowSpecId,
            @Valid @RequestBody WeightConfigUpdateRequest request) {
        return ResponseEntity.ok(weightConfigService.updateWeightConfig(narrowSpecId, request));
    }

    @GetMapping("/{narrowSpecId}/weight-config/audit")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
    public ResponseEntity<Page<WeightConfigAuditResponse>> getWeightConfigAudit(
            @PathVariable UUID narrowSpecId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(weightConfigService.getWeightConfigAudit(narrowSpecId, pageable));
    }
}
