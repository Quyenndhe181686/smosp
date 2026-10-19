package com.sep490_g47.smosp.crawler.event;

import com.sep490_g47.smosp.crawler.dto.response.NormalizeResultDto;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.service.NormalizeService;
import com.sep490_g47.smosp.crawler.service.TrendingWeightService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dọn các tracking PENDING "mồ côi" — tracking bị đá về PENDING nhưng không còn ai
 * kích hoạt normalize cho nó nữa.
 *
 * Vì sao có mồ côi: 1 raw_job có thể nằm trong filter category của nhiều
 * Specialization. Khi batch của Specialization X cào lại job đó và payload đổi,
 * {@code resetToPendingByRawJobId} đá tracking của MỌI Specialization về PENDING —
 * kể cả Specialization A đã normalize xong từ trước và đã bắn NormalizeCompletedEvent
 * của mình. A không còn sự kiện nào để chạy lại, nên tracking đó nằm PENDING vĩnh
 * viễn và dữ liệu của A thiếu đi một phần.
 *
 * Có 2 đường gọi vào đây:
 *  - {@link CrawlPipelineListener} gọi ngay sau mỗi lần tính trending weight —
 *    dọn nóng, phản ứng nhanh trong lúc hệ thống đang hoạt động;
 *  - {@link #scheduledSweep()} chạy theo lịch — bọc trường hợp hệ thống nằm im
 *    nhiều ngày không có đợt crawl nào, khi đó không có NormalizeCompletedEvent nào
 *    để kích hoạt đường trên và mồ côi sẽ nằm lại vô thời hạn.
 *
 * Các lớp chặn (áp dụng cho cả 2 đường gọi):
 *  - còn batch RUNNING thì hoãn: đợt crawl chưa xong, normalize của các
 *    Specialization khác vẫn đang xếp hàng, quét vào là giẫm chân nhau;
 *  - chỉ lấy tracking PENDING đã nằm im quá STALE_AFTER_MINUTES, để không đụng vào
 *    tracking đang thuộc một pipeline còn sống;
 *  - MAX_SWEEP_PASSES: tối đa 3 lượt, còn PENDING cũng dừng;
 *  - sweepInFlight: 2 luồng song song không cùng quét 1 Specialization. Bean là
 *    singleton nên Set này chặn được cả giữa listener và scheduler.
 * Ngoài ra normalizeBySpecialization() KHÔNG bắn NormalizeCompletedEvent nên vòng
 * quét không tự gọi lại chính nó.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrphanTrackingSweeper {

    /** Trần số lượt quét trong 1 lần chạy — chặn cứng vòng lặp. */
    private static final int MAX_SWEEP_PASSES = 3;

    /**
     * Tracking PENDING mới hơn mốc này được coi là đang thuộc một pipeline còn sống,
     * vòng quét không đụng vào. Đặt rộng hơn thời gian normalize 1 Specialization.
     */
    private static final int STALE_AFTER_MINUTES = 15;

    /**
     * Batch RUNNING cũ hơn mốc này bị coi là xác chết, không tính là "đang chạy" —
     * nếu không, một batch kẹt RUNNING sẽ khóa vĩnh viễn vòng quét.
     */
    private static final int LIVE_BATCH_MAX_AGE_HOURS = 2;

    private final NormalizeService normalizeService;
    private final TrendingWeightService trendingWeightService;
    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final CrawlBatchRepository crawlBatchRepository;

    /** Chặn 2 luồng chạy song song cùng quét 1 Specialization. */
    private final Set<UUID> sweepInFlight = ConcurrentHashMap.newKeySet();

    @Value("${smosp.crawler.sweep.enabled:true}")
    private boolean sweepEnabled;

    /**
     * Quét theo lịch — mặc định 3h sáng hằng ngày, giờ thấp điểm vì mỗi lượt có thể
     * chạy normalize thật và chiếm thread khá lâu.
     *
     * Đây là lưới an toàn cho trường hợp hệ thống chạy liên tục nhiều ngày mà không
     * có đợt crawl mới: khi đó không có NormalizeCompletedEvent nào, đường dọn nóng
     * qua CrawlPipelineListener không bao giờ kích hoạt.
     */
    @Scheduled(cron = "${smosp.crawler.sweep.cron:0 0 3 * * *}")
    public void scheduledSweep() {
        sweep("scheduled");
    }

    /**
     * @param trigger nhãn nguồn gọi, chỉ dùng cho log (vd "batch <id>", "scheduled")
     */
    public void sweep(String trigger) {
        if (!sweepEnabled) {
            log.debug("[sweep] Đã tắt qua smosp.crawler.sweep.enabled=false — bỏ qua ({})", trigger);
            return;
        }

        LocalDateTime liveBatchSince = LocalDateTime.now().minusHours(LIVE_BATCH_MAX_AGE_HOURS);
        if (crawlBatchRepository.existsByStatusAndStartedAtAfter("RUNNING", liveBatchSince)) {
            log.debug("[sweep] Còn batch đang cào — hoãn dọn tracking mồ côi tới lượt sau ({})", trigger);
            return;
        }

        for (int pass = 1; pass <= MAX_SWEEP_PASSES; pass++) {
            LocalDateTime staleBefore = LocalDateTime.now().minusMinutes(STALE_AFTER_MINUTES);
            List<UUID> specIds = jobNormalizeTrackingRepository.findSpecializationIdsWithStalePending(staleBefore);
            if (specIds.isEmpty()) {
                return;
            }

            boolean processedAnything = false;
            for (UUID specId : specIds) {
                // Specialization này đang được luồng khác quét — bỏ qua, khỏi chạy chồng.
                if (!sweepInFlight.add(specId)) {
                    continue;
                }
                try {
                    NormalizeResultDto result = normalizeService.normalizeBySpecialization(specId);
                    int handled = result.getTotalSuccess() + result.getTotalFailed();
                    if (handled > 0) {
                        processedAnything = true;
                        log.info("[sweep pass {}] Specialization {}: dọn xong {} tracking mồ côi (nguồn gọi: {})",
                                pass, specId, handled, trigger);
                        // Dữ liệu normalized vừa đổi thì trending weight của chính
                        // Specialization đó cũng phải tính lại, nếu không đề xuất sẽ
                        // dựa trên số liệu thiếu.
                        trendingWeightService.calculateTrendingWeights(specId);
                    }
                } catch (Exception e) {
                    log.error("[sweep pass {}] Dọn tracking mồ côi THẤT BẠI cho Specialization {} — "
                            + "chạy lại bằng POST /api/cm/crawler/normalize-all", pass, specId, e);
                } finally {
                    sweepInFlight.remove(specId);
                }
            }

            // Không xử lý được gì thêm (toàn bộ đang do luồng khác giữ, hoặc lỗi)
            // → lặp thêm cũng vô ích.
            if (!processedAnything) {
                return;
            }
        }
        log.warn("[sweep] Vẫn còn tracking PENDING sau {} lượt quét — dừng để tránh lặp vô hạn. "
                + "Kiểm tra job_normalize_tracking WHERE status='PENDING'.", MAX_SWEEP_PASSES);
    }
}
