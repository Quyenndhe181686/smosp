package com.sep490_g47.smosp.crawler.event;

import java.util.UUID;

/**
 * Bắn ra khi 1 crawl_batch đã cào xong toàn bộ trang và trạng thái cuối đã commit
 * (SUCCESS / PARTIAL_SUCCESS). Mắt xích 1 của chuỗi tự động
 * crawl ➔ normalize ➔ trending weight.
 *
 * @param batchId          crawl_batch.id vừa cào xong
 * @param specializationId scope_specialization_id của batch
 */
public record CrawlCompletedEvent(UUID batchId, UUID specializationId) {
}
