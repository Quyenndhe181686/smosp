package com.sep490_g47.smosp.crawler.service;

import com.sep490_g47.smosp.crawler.adapter.VietnamWorksAdapter;
import com.sep490_g47.smosp.crawler.dto.response.CrawlBatchResponse;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Các truy vấn phục vụ màn theo dõi crawl của Content Manager.
 *
 * Tách khỏi {@link CrawlService} vì đây thuần đọc: không tạo batch, không đẩy
 * hàng đợi, không phát sự kiện. Trước đây toàn bộ phần này nằm thẳng trong
 * {@code CrawlerController} và gọi repository trực tiếp, khiến tầng biên vừa lo
 * HTTP vừa lo truy vấn, và mỗi endpoint đọc nhiều bảng lại chạy ngoài transaction.
 */
public interface CrawlQueryService {

    /** Toàn bộ lịch sử batch, không tính stage (mỗi batch tốn thêm 2 query). */
    List<CrawlBatchResponse> getBatches();

    /** Batch có pipeline đang chạy dở, kèm đầy đủ field tiến độ. */
    List<CrawlBatchResponse> getActiveBatches();

    /** Một batch cụ thể, kèm stage và error log. */
    CrawlBatchResponse getBatchDetails(UUID batchId);

    /** Danh sách lỗi đã ghi trong error_log của batch. */
    List<VietnamWorksAdapter.CrawlError> getBatchErrors(UUID batchId);

    /** Tiến độ normalize của Chuyên ngành gắn với batch. */
    Map<String, Object> getNormalizeStatus(UUID batchId);
}
