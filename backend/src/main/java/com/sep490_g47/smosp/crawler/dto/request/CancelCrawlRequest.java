package com.sep490_g47.smosp.crawler.dto.request;

import lombok.Data;

/**
 * Lý do dừng một phiên crawl.
 *
 * CỐ Ý không đặt {@code @NotBlank}: người tự dừng phiên của mình thì không cần
 * giải trình với ai. Ràng buộc "phải nêu lý do" chỉ áp khi dừng phiên của NGƯỜI
 * KHÁC, và được kiểm ở tầng service nơi biết được ai là chủ phiên — xem
 * {@code CrawlServiceImpl.requestCancel()}.
 */
@Data
public class CancelCrawlRequest {
    private String reason;
}
