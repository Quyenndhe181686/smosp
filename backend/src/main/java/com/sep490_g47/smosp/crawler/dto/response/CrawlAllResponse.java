package com.sep490_g47.smosp.crawler.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class CrawlAllResponse {
    private List<CrawlAllResultItem> results;
    private int totalSpecializationsProcessed;
    private int totalSpecializationsFailed;
}
