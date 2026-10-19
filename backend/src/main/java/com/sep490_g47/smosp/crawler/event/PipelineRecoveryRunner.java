package com.sep490_g47.smosp.crawler.event;

import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.service.NormalizeService;
import com.sep490_g47.smosp.crawler.service.impl.CrawlPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Dọn dẹp phần việc dở dang của pipeline sau khi server khởi động lại.
 *
 * Vì sao cần: toàn bộ pipeline chạy trên crawlExecutor — thread nền, không có
 * trạng thái nào được ghi ra ngoài DB. Server tắt/restart/crash giữa chừng thì
 * thread biến mất im lặng, không có exception nào để catch, và KHÔNG CÒN sự kiện
 * nào phát ra nữa. Hậu quả:
 *
 *  1. crawl_batch đang RUNNING nằm RUNNING vĩnh viễn — vừa hiện mãi ở
 *     /batches/active, vừa khóa luôn lần cào sau của Specialization đó
 *     (guard existsByStatusAndScopeSpecialization_Id).
 *  2. job_normalize_tracking đang PENDING không bao giờ được xử lý tiếp —
 *     CrawlPipelineListener chỉ dọn khi có NormalizeCompletedEvent, mà muốn có
 *     sự kiện đó thì phải chạy một đợt crawl mới. UI vì vậy đứng mãi ở
 *     "Đang chuẩn hóa" dù batch đã SUCCESS.
 *
 * Đây chính là tình huống phải chạy tay
 * {@code UPDATE job_normalize_tracking SET status='FAILED' WHERE status='PENDING'}
 * để gỡ. Class này làm việc đó tự động, và tốt hơn: thay vì vứt bỏ dữ liệu, nó
 * chạy lại normalize cho phần còn dở — normalize là thao tác thuần tính toán lại
 * từ raw_job đã có sẵn, chạy lại không mất mát gì.
 *
 * CHỐNG CRASH LOOP: nếu chính normalize là thứ làm server chết (vd OOM trên một
 * payload dị thường), khôi phục vô điều kiện sẽ thành vòng lặp
 * "restart ➔ normalize ➔ chết ➔ restart". Hai lớp chặn:
 *
 *  - Bộ đếm {@code recovery_attempts} tăng và COMMIT NGAY trước khi normalize chạy.
 *    Server chết ngay sau đó thì lần sau vẫn đọc được số đã tăng. Vượt
 *    {@code max-attempts} thì tracking bị đánh FAILED và loại khỏi hàng đợi — vòng
 *    lặp tự gãy mà không cần ai can thiệp.
 *  - Cờ {@code smosp.crawler.recovery.enabled=false} để tắt tay khi cần khởi động
 *    server lên mà tuyệt đối không đụng vào dữ liệu dở.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PipelineRecoveryRunner {

    private static final String RESTART_REASON = "Interrupted by server restart";

    private final CrawlBatchRepository crawlBatchRepository;
    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final CrawlPersistenceService crawlPersistenceService;
    private final NormalizeService normalizeService;

    @Value("${smosp.crawler.recovery.enabled:true}")
    private boolean recoveryEnabled;

    /** Số lần cố khôi phục 1 tracking trước khi bỏ cuộc và đánh FAILED. */
    @Value("${smosp.crawler.recovery.max-attempts:3}")
    private int maxRecoveryAttempts;

    /** Quá ngần này phút mà batch vẫn RUNNING thì coi như đã chết — xem CrawlPersistenceService. */
    @Value("${smosp.crawler.stale-batch-minutes:120}")
    private int staleBatchMinutes;

    @EventListener(ApplicationReadyEvent.class)
    public void recoverInterruptedPipeline() {
        if (!recoveryEnabled) {
            log.warn("[recovery] Đã TẮT qua smosp.crawler.recovery.enabled=false — bỏ qua khôi phục pipeline. "
                    + "Batch kẹt RUNNING và tracking PENDING sẽ nằm nguyên cho tới khi bật lại "
                    + "hoặc xử lý tay.");
            return;
        }
        closeZombieCrawlBatches();
        resumeInterruptedNormalize();
    }

    /**
     * Vòng quét ĐỊNH KỲ đóng batch treo — lưới an toàn cho server chạy liên tục.
     *
     * VÌ SAO CẦN: {@link #recoverInterruptedPipeline()} chỉ chạy đúng một lần lúc
     * ApplicationReadyEvent, và trước đây đó là NƠI DUY NHẤT trong cả hệ thống chủ
     * động đóng batch kẹt RUNNING. Server không restart thì không tiến trình nào
     * dọn — batch treo nằm nguyên "vĩnh viễn theo đúng nghĩa đen", và guard chặn
     * luôn lần cào sau của Chuyên ngành đó cho tới khi có người sửa tay DB.
     *
     * Khác với lượt lúc khởi động: lượt đó đóng MỌI batch RUNNING (sau restart thì
     * chắc chắn không còn thread nào chạy), còn lượt định kỳ chạy song song với
     * phiên cào thật nên BẮT BUỘC lọc theo ngưỡng thời gian, nếu không sẽ giết
     * nhầm phiên đang cào dở.
     */
    @Scheduled(fixedDelayString = "${smosp.crawler.recovery.sweep-interval-ms:900000}",
               initialDelayString = "${smosp.crawler.recovery.sweep-interval-ms:900000}")
    public void closeStaleBatchesPeriodically() {
        if (!recoveryEnabled) {
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(staleBatchMinutes);
        List<CrawlBatch> stale = crawlBatchRepository.findByStatusAndStartedAtBefore("RUNNING", cutoff);
        if (stale.isEmpty()) {
            return;
        }

        log.warn("[recovery] Vòng quét định kỳ: {} batch treo quá {} phút ở RUNNING — đóng lại",
                stale.size(), staleBatchMinutes);
        for (CrawlBatch batch : stale) {
            try {
                crawlPersistenceService.markPipelineFailed(batch.getId(),
                        "Treo quá " + staleBatchMinutes + " phút ở RUNNING (bắt đầu lúc "
                                + batch.getStartedAt() + ") — vòng quét định kỳ tự đóng");
                log.warn("[recovery] Đã đóng batch treo {} (bắt đầu {}) → FAILED", batch.getId(), batch.getStartedAt());
            } catch (Exception e) {
                log.error("[recovery] Không đóng được batch treo {} — cần xử lý tay", batch.getId(), e);
            }
        }
    }

    /**
     * Phiên cào không thể tiếp tục sau restart (đã mất toàn bộ tiến độ trong RAM:
     * số trang đang đọc, con trỏ phân trang) nên chỉ có thể đóng lại. Dữ liệu đã ghi
     * xuống DB theo từng trang vẫn được giữ nguyên — CM cào lại là chạy tiếp từ đó.
     */
    private void closeZombieCrawlBatches() {
        List<CrawlBatch> zombies = crawlBatchRepository.findByStatus("RUNNING");
        if (zombies.isEmpty()) {
            return;
        }
        log.warn("[recovery] Phát hiện {} crawl_batch kẹt ở RUNNING do server dừng giữa chừng — đóng lại", zombies.size());
        for (CrawlBatch batch : zombies) {
            try {
                crawlPersistenceService.markPipelineFailed(batch.getId(), RESTART_REASON);
                log.warn("[recovery] Đã đóng batch {} (bắt đầu lúc {}) → FAILED", batch.getId(), batch.getStartedAt());
            } catch (Exception e) {
                log.error("[recovery] Không đóng được batch {} — cần xử lý tay", batch.getId(), e);
            }
        }
    }

    /**
     * Chạy lại normalize cho mọi Specialization còn tracking PENDING.
     *
     * Cố ý KHÔNG đánh FAILED hàng loạt như cách gỡ tay: tracking PENDING chỉ có
     * nghĩa "chưa tính", raw_job vẫn còn nguyên, nên chạy lại vừa lấy lại được dữ
     * liệu vừa đưa normalize-status về 0 một cách trung thực. Chỉ những tracking đã
     * thử quá số lần cho phép mới bị bỏ.
     */
    private void resumeInterruptedNormalize() {
        // Thứ tự ở đây là điều quan trọng nhất của cơ chế chống crash loop:
        // TĂNG bộ đếm (commit) ➔ LOẠI thằng vượt ngưỡng (commit) ➔ rồi mới chạy
        // normalize. Nếu normalize làm chết server, hai bước đầu đã nằm trong DB.
        int touched = jobNormalizeTrackingRepository.incrementRecoveryAttemptsForPending();
        if (touched == 0) {
            return;
        }

        int abandoned = jobNormalizeTrackingRepository.failPendingExceedingRecoveryAttempts(
                "Bỏ qua sau " + maxRecoveryAttempts + " lần khôi phục không thành công — "
                        + "nghi ngờ payload gây lỗi tiến trình normalize",
                maxRecoveryAttempts);
        if (abandoned > 0) {
            log.error("[recovery] BỎ CUỘC với {} tracking đã khôi phục quá {} lần — đánh FAILED để cắt vòng lặp "
                            + "restart. Rất có thể payload của chúng làm chết tiến trình normalize; "
                            + "tra raw_job qua: SELECT raw_job_id FROM job_normalize_tracking "
                            + "WHERE status='FAILED' AND recovery_attempts > {}",
                    abandoned, maxRecoveryAttempts, maxRecoveryAttempts);
        }

        List<UUID> specIds = jobNormalizeTrackingRepository.findDistinctSpecializationIdsByStatus("PENDING");
        if (specIds.isEmpty()) {
            return;
        }
        log.warn("[recovery] Còn tracking PENDING ở {} Specialization — chạy lại normalize nền cho từng cái", specIds.size());
        for (UUID specId : specIds) {
            try {
                normalizeService.normalizeBySpecializationAsync(specId);
            } catch (Exception e) {
                // Thường là crawlExecutor từ chối vì hàng đợi đầy (queueCapacity=20).
                // Không chặn khởi động — CM có thể gọi lại POST /api/cm/crawler/normalize-all.
                log.error("[recovery] Không đưa được Specialization {} vào hàng đợi normalize — "
                        + "chạy lại bằng POST /api/cm/crawler/normalize-all", specId, e);
            }
        }
    }
}
