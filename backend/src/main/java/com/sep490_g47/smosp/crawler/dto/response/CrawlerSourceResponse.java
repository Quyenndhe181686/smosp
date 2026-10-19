package com.sep490_g47.smosp.crawler.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class CrawlerSourceResponse {
    private UUID id;
    private String name;
    private String adapterKey;
    private Boolean isEnabled;
    private String scheduleCron;
    private LocalDateTime lastRunAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    private Long totalBatches;
    private String lastBatchStatus;

    /** BR-38/BV-40a — xem CrawlerSource.consecutiveFailures. */
    private Integer consecutiveFailures;
    private LocalDateTime firstFailureAt;
    private LocalDateTime lastSuccessAt;
}
