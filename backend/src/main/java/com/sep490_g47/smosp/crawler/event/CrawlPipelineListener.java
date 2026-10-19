package com.sep490_g47.smosp.crawler.event;

import com.sep490_g47.smosp.crawler.service.NormalizeService;
import com.sep490_g47.smosp.crawler.service.TrendingWeightService;
import com.sep490_g47.smosp.crawler.service.impl.CrawlPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Nối 3 bước của pipeline lại với nhau: cào xong ➔ tự chuẩn hóa ➔ tự tính trending
 * weight. Không viết lại logic — gọi lại đúng các service mà 3 endpoint thủ công
 * vẫn dùng, nên endpoint thủ công tiếp tục đóng vai trò "chạy lại từng bước" khi
 * một mắt xích hỏng.
 *
 * Dùng @EventListener thường (không phải @TransactionalEventListener): cả 2 event
 * đều được bắn từ crawl-job-* thread SAU khi transaction ghi DB đã commit xong, nên
 * không có transaction nào đang mở để mà chờ AFTER_COMMIT.
 *
 * Listener cũng không cần @Async: bản thân nó đã chạy trên crawl-job-* thread, và
 * việc nó gọi tiếp normalizeBatchAsync() mới là chỗ nhả thread. Thêm @Async ở đây
 * chỉ tốn thêm 1 slot của crawlExecutor (corePoolSize=2) một cách vô ích.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CrawlPipelineListener {

    private final NormalizeService normalizeService;
    private final TrendingWeightService trendingWeightService;
    private final CrawlPersistenceService crawlPersistenceService;
    private final OrphanTrackingSweeper orphanTrackingSweeper;

    @EventListener
    public void onCrawlCompleted(CrawlCompletedEvent event) {
        log.info("[pipeline] Batch {} cào xong — đưa bước chuẩn hóa vào hàng đợi", event.batchId());
        try {
            normalizeService.normalizeBatchAsync(event.batchId());
        } catch (Exception e) {
            // Ở đây chỉ bắt được lỗi lúc ĐƯA VÀO hàng đợi (vd crawlExecutor từ chối
            // task khi queue đầy). Lỗi trong lúc chạy normalize do chính
            // normalizeBatchAsync xử lý và đánh dấu batch FAILED.
            log.error("[pipeline] Không đưa được batch {} vào hàng đợi chuẩn hóa — đánh dấu batch FAILED, "
                    + "chạy lại bằng POST /api/cm/crawler/batches/{}/normalize",
                    event.batchId(), event.batchId(), e);
            crawlPersistenceService.markPipelineFailed(event.batchId(),
                    "Auto-normalize dispatch failed: " + e.getMessage());
        }
    }

    /**
     * batchId có thể NULL: sự kiện này còn được bắn từ đường normalize theo
     * Specialization (PipelineRecoveryRunner sau restart, POST /normalize-all) —
     * những lần đó không gắn với một crawl_batch nào. Mọi chỗ dùng batchId dưới đây
     * đều phải chịu được null.
     */
    @EventListener
    public void onNormalizeCompleted(NormalizeCompletedEvent event) {
        String nguon = event.batchId() != null ? "batch " + event.batchId() : "normalize theo Specialization";
        log.info("[pipeline] {} chuẩn hóa xong — tính trending weight cho Specialization {}",
                nguon, event.specializationId());
        try {
            // Truyền batchId xuống để mỗi đề xuất ghi được "đợt" thật của mình.
            // Null ở đây là hợp lệ (normalize theo Specialization, không từ batch nào)
            // và calculateTrendingWeights chịu được null.
            int proposals = trendingWeightService
                    .calculateTrendingWeights(event.specializationId(), event.batchId()).size();
            log.info("[pipeline] {} đã tạo {} đề xuất trending weight", nguon, proposals);
        } catch (Exception e) {
            log.error("[pipeline] Tính trending weight tự động THẤT BẠI cho {} — "
                    + "chạy lại bằng POST /api/cm/crawler/trending-weight/calculate", nguon, e);
            // Không có batch thì không có gì để đánh dấu FAILED — chỉ log là đủ.
            if (event.batchId() != null) {
                crawlPersistenceService.markPipelineFailed(event.batchId(),
                        "Auto trending-weight calculation failed: " + e.getMessage());
            }
        }

        // Dọn nóng ngay sau mỗi đợt. Lưới an toàn cho trường hợp hệ thống nằm im
        // nhiều ngày là OrphanTrackingSweeper.scheduledSweep().
        orphanTrackingSweeper.sweep(nguon);
    }
}
