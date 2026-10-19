package com.sep490_g47.smosp.transcript.service;

import com.sep490_g47.smosp.transcript.dto.request.TranscriptMappingPresetRequest;
import com.sep490_g47.smosp.transcript.dto.response.TranscriptMappingPresetResponse;
import java.util.List;
import java.util.UUID;

public interface TranscriptPresetService {
    List<TranscriptMappingPresetResponse> getAllPresets();
    TranscriptMappingPresetResponse createPreset(TranscriptMappingPresetRequest request);
    TranscriptMappingPresetResponse updatePreset(UUID id, TranscriptMappingPresetRequest request);
    void deletePreset(UUID id);
    TranscriptMappingPresetResponse activatePreset(UUID id);
}

