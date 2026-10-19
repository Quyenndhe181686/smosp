package com.sep490_g47.smosp.crawler.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class CrawlAllResultItem {
    private UUID specializationId;
    private String specializationCode;
    private boolean success;
    private String errorMessage;
    private CrawlBatchResponse batch;
}
