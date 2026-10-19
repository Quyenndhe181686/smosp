package com.sep490_g47.smosp.crawler.service;

import com.sep490_g47.smosp.crawler.dto.response.CrawlAllResponse;
import com.sep490_g47.smosp.crawler.dto.response.CrawlBatchResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;

import java.util.UUID;

public interface CrawlService {

    /** Validate cấu hình + tạo batch RUNNING trong 1 transaction ngắn. Gọi đồng bộ từ controller. */
    CrawlBatch prepareBatch(UUID specializationId, String username);

    /** Chạy crawl cho batch đã tạo, trên crawlExecutor. Không ném exception ra ngoài — kết quả ghi vào batch. */
    void runCrawlAsync(UUID batchId);

    /**
     * Tạo batch rồi đẩy vào hàng đợi cho MỘT Chuyên ngành, kèm việc đóng lại batch
     * nếu không đưa được vào hàng đợi.
     */
    CrawlBatchResponse runOne(UUID specializationId, String username);

    /** Cào toàn bộ Chuyên ngành đang hoạt động và đã cấu hình category VietnamWorks. */
    CrawlAllResponse runAll(String username);

    /**
     * Xin dừng một phiên crawl đang chạy.
     *
     * @param requesterId người bấm dừng
     * @param requesterIsAdmin true nếu là ROLE_ADMIN/ROLE_SUPER_ADMIN — chỉ Admin
     *        mới được dừng phiên của người khác
     */
    void requestCancel(UUID batchId, UUID requesterId, boolean requesterIsAdmin, String reason);

    /**
     * Xin dừng MỌI phiên crawl mà người gọi được phép dừng.
     *
     * Admin dừng được tất cả; Content Manager chỉ dừng được phiên của chính mình —
     * cùng quy tắc với {@link #requestCancel}, không có đường vòng nào để CM dừng
     * phiên người khác bằng cách bấm "dừng tất cả".
     *
     * @return số phiên đã gửi được yêu cầu dừng
     */
    int requestCancelAll(UUID requesterId, boolean requesterIsAdmin, String reason);
}
