package com.sep490_g47.smosp.crawler.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class CrawlerKeywordMapResponse {
    private UUID id;
    private UUID narrowSpecId;
    private String narrowSpecName;
    private String keyword;
    private boolean active;
    /** Hạng của từ khoá: CORE_IDENTIFIER / CORE_BASE / SUPPORT. */
    private String tier;
    /** Điểm cộng khi khớp. Trả về để CM thấy đúng thứ mình đã đặt. */
    private Integer score;
}
