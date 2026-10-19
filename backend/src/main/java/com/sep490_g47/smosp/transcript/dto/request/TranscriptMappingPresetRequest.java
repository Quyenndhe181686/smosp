package com.sep490_g47.smosp.transcript.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TranscriptMappingPresetRequest {
    @NotBlank(message = "Preset name must not be blank")
    private String presetName;

    @NotNull(message = "Column mapping must not be null")
    private Map<String, String> columnMapping;
}

