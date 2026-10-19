package com.sep490_g47.smosp.crawler.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NormalizeResultDto {
    private int totalSuccess;
    private int totalFailed;
    private int unmatchedCount;
    private List<BreakdownItem> breakdown;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BreakdownItem {
        private String narrowSpecCode;
        private int count;
    }
}
