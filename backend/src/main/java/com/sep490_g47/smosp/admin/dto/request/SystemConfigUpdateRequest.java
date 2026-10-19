package com.sep490_g47.smosp.admin.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemConfigUpdateRequest {
    private List<Entry> configs;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        @NotBlank
        private String configKey;
        @NotBlank
        private String configValue;
    }
}
