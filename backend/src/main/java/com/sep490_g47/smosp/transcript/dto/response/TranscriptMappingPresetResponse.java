package com.sep490_g47.smosp.transcript.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;


@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TranscriptMappingPresetResponse extends BaseResponse {
    private UUID id;
    private String presetName;
    private Map<String, String> columnMapping;
    private Boolean isDefault;
    private Boolean isActive;
}

