package com.sep490_g47.smosp.transcript.controller;

import com.sep490_g47.smosp.transcript.dto.request.TranscriptMappingPresetRequest;
import com.sep490_g47.smosp.transcript.dto.response.TranscriptMappingPresetResponse;
import com.sep490_g47.smosp.transcript.service.TranscriptPresetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/transcript-presets")
@RequiredArgsConstructor
public class AdminTranscriptPresetController {

    private final TranscriptPresetService presetService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TranscriptMappingPresetResponse>> getAllPresets() {
        return ResponseEntity.ok(presetService.getAllPresets());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TranscriptMappingPresetResponse> createPreset(@Valid @RequestBody TranscriptMappingPresetRequest request) {
        return ResponseEntity.ok(presetService.createPreset(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TranscriptMappingPresetResponse> updatePreset(
            @PathVariable UUID id,
            @Valid @RequestBody TranscriptMappingPresetRequest request) {
        return ResponseEntity.ok(presetService.updatePreset(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePreset(@PathVariable UUID id) {
        presetService.deletePreset(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TranscriptMappingPresetResponse> activatePreset(@PathVariable UUID id) {
        return ResponseEntity.ok(presetService.activatePreset(id));
    }
}

