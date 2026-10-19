package com.sep490_g47.smosp.interest.controller;

import com.sep490_g47.smosp.interest.dto.request.InterestOptionRequest;
import com.sep490_g47.smosp.interest.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.interest.dto.response.InterestOptionResponse;
import com.sep490_g47.smosp.interest.service.InterestOptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cm")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
public class CmInterestController {

    private final InterestOptionService interestOptionService;

    @GetMapping("/specializations/{id}/interests")
    public ResponseEntity<List<InterestOptionResponse>> getSpecializationInterests(@PathVariable UUID id) {
        return ResponseEntity.ok(interestOptionService.getSpecializationInterests(id));
    }

    @PostMapping("/interests")
    public ResponseEntity<InterestOptionResponse> createInterestOption(@Valid @RequestBody InterestOptionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(interestOptionService.createInterestOption(request));
    }

    @PutMapping("/interests/{id}")
    public ResponseEntity<InterestOptionResponse> updateInterestOption(
            @PathVariable UUID id,
            @Valid @RequestBody InterestOptionRequest request) {
        return ResponseEntity.ok(interestOptionService.updateInterestOption(id, request));
    }

    @PatchMapping("/interests/{id}/status")
    public ResponseEntity<InterestOptionResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody StatusUpdateRequest request) {
        return ResponseEntity.ok(interestOptionService.updateStatus(id, request));
    }
}
