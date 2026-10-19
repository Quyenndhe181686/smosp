package com.sep490_g47.smosp.crawler.scheduler;

import com.sep490_g47.smosp.admin.repository.SystemConfigRepository;
import com.sep490_g47.smosp.crawler.service.CrawlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Bộ lập lịch tự động cào dữ liệu thị trường.
 *
 * Chạy mỗi phút một lần để kiểm tra xem đã đến chu kỳ cào chưa. Logic:
 * <ol>
 *   <li>Lấy {@code crawler_schedule} (số ngày, mặc định 7).</li>
 *   <li>Lấy {@code crawler_schedule_time} (giờ trong ngày, mặc định "02:30").</li>
 *   <li>Lấy {@code crawler_last_auto_run} (ngày chạy gần nhất, dạng YYYY-MM-DD).</li>
 *   <li>Nếu khoảng cách từ lần chạy gần nhất đến hôm nay >= chu kỳ VÀ giờ hiện tại
 *       đã đến hoặc qua {@code schedule_time} thì kích hoạt {@link CrawlService#runAll(String)}.</li>
 *   <li>Sau khi kích hoạt, ghi lại ngày hôm nay vào {@code crawler_last_auto_run}.</li>
 * </ol>
 *
 * <b>Lưu ý quan trọng:</b> Scheduler chỉ kích hoạt — không chờ cho đến khi hoàn tất.
 * {@code runAll()} trả về ngay sau khi đẩy batch vào hàng đợi crawl; công việc thực
 * thi trên {@code crawlExecutor} thread pool riêng biệt.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CrawlScheduler {

    private static final String KEY_SCHEDULE_DAYS = "crawler_schedule";
    private static final String KEY_SCHEDULE_TIME = "crawler_schedule_time";
    private static final String KEY_LAST_AUTO_RUN = "crawler_last_auto_run";

    private static final int DEFAULT_INTERVAL_DAYS = 7;
    private static final String DEFAULT_SCHEDULE_TIME = "02:30";
    private static final String SYSTEM_TRIGGER_USER = "scheduler";

    private final CrawlService crawlService;
    private final SystemConfigRepository systemConfigRepository;

    /**
     * Kiểm tra và kích hoạt đợt cào tự động mỗi phút.
     *
     * Dùng cron "0 * * * * *" (giây = 0 của mỗi phút) thay vì fixedRate để tránh
     * bị trễ tích lũy nếu một lần chạy mất hơn 1 phút (hầu như không xảy ra vì
     * method này chỉ đọc DB và kích hoạt async, không chờ crawl).
     */
    @Scheduled(cron = "0 * * * * *")
    public void checkAndRunScheduledCrawl() {
        try {
            // Đọc toàn bộ config liên quan trong 1 lượt
            Map<String, String> configs = systemConfigRepository.findAll()
                    .stream()
                    .filter(c -> KEY_SCHEDULE_DAYS.equals(c.getConfigKey())
                            || KEY_SCHEDULE_TIME.equals(c.getConfigKey())
                            || KEY_LAST_AUTO_RUN.equals(c.getConfigKey()))
                    .collect(Collectors.toMap(
                            com.sep490_g47.smosp.admin.entity.SystemConfig::getConfigKey,
                            com.sep490_g47.smosp.admin.entity.SystemConfig::getConfigValue));

            int intervalDays = parseIntervalDays(configs.get(KEY_SCHEDULE_DAYS));
            LocalTime scheduledTime = parseScheduleTime(configs.get(KEY_SCHEDULE_TIME));
            LocalDate lastRunDate = parseLastRunDate(configs.get(KEY_LAST_AUTO_RUN));

            LocalDate today = LocalDate.now();
            LocalTime nowTime = LocalTime.now();

            // Chưa đến ngày cào
            boolean dueByDate = lastRunDate == null
                    || today.minusDays(intervalDays).compareTo(lastRunDate) >= 0;

            if (!dueByDate) {
                return;
            }

            // Chưa đến giờ cào trong ngày
            if (nowTime.isBefore(scheduledTime)) {
                return;
            }

            // Đã cào rồi hôm nay (tránh chạy 2 lần nếu hệ thống khởi động lại giữa chừng)
            if (today.equals(lastRunDate)) {
                return;
            }

            log.info("[CrawlScheduler] Kích hoạt đợt cào tự động — chu kỳ: {} ngày, giờ: {}, lần trước: {}",
                    intervalDays, scheduledTime, lastRunDate);

            // Ghi mốc TRƯỚC khi kích hoạt để tránh kích hoạt 2 lần nếu runAll() ném lỗi
            // nhưng scheduler vẫn sống (rất hiếm nhưng có thể xảy ra trong 1 phút tiếp theo).
            saveLastAutoRunDate(today);

            try {
                // PHẢI đọc kết quả trả về. runAll() bắt lỗi theo TỪNG Chuyên ngành và
                // không bao giờ ném ra ngoài, nên "không có exception" hoàn toàn không
                // đồng nghĩa với "mọi Chuyên ngành đều vào được hàng đợi". Bản cũ chỉ
                // log "thành công" chung chung: một Chuyên ngành bị guard chặn vì batch
                // kẹt RUNNING sẽ bị bỏ sót âm thầm mỗi tuần, trong khi log vẫn báo êm
                // đẹp — vận hành không có cách nào biết dữ liệu ngành đó đã ngừng cập
                // nhật từ lâu.
                var result = crawlService.runAll(SYSTEM_TRIGGER_USER);
                int total = result.getTotalSpecializationsProcessed();
                int failed = result.getTotalSpecializationsFailed();

                if (failed == 0) {
                    log.info("[CrawlScheduler] Đã đẩy {}/{} Chuyên ngành vào hàng đợi.", total - failed, total);
                } else {
                    String lyDo = result.getResults() == null ? "" : result.getResults().stream()
                            .filter(r -> !r.isSuccess())
                            .map(r -> r.getSpecializationCode() + ": " + r.getErrorMessage())
                            .collect(Collectors.joining(" | "));
                    log.error("[CrawlScheduler] Đợt cào tự động BỎ SÓT {}/{} Chuyên ngành — {}",
                            failed, total, lyDo);
                }
            } catch (Exception e) {
                log.error("[CrawlScheduler] Không kích hoạt được đợt cào tự động", e);
            }

        } catch (Exception e) {
            // Không để lỗi đọc config làm crash scheduler thread
            log.error("[CrawlScheduler] Lỗi không mong đợi khi kiểm tra lịch cào", e);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private int parseIntervalDays(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT_INTERVAL_DAYS;
        try {
            int days = Integer.parseInt(raw.trim());
            return (days >= 1 && days <= 30) ? days : DEFAULT_INTERVAL_DAYS;
        } catch (NumberFormatException e) {
            log.warn("[CrawlScheduler] crawler_schedule không hợp lệ ('{}'): dùng mặc định {} ngày", raw, DEFAULT_INTERVAL_DAYS);
            return DEFAULT_INTERVAL_DAYS;
        }
    }

    private LocalTime parseScheduleTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalTime.parse(DEFAULT_SCHEDULE_TIME);
        }
        try {
            return LocalTime.parse(raw.trim());
        } catch (DateTimeParseException e) {
            log.warn("[CrawlScheduler] crawler_schedule_time không hợp lệ ('{}'): dùng mặc định {}", raw, DEFAULT_SCHEDULE_TIME);
            return LocalTime.parse(DEFAULT_SCHEDULE_TIME);
        }
    }

    private LocalDate parseLastRunDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            log.warn("[CrawlScheduler] crawler_last_auto_run không hợp lệ ('{}'): coi như chưa chạy lần nào", raw);
            return null;
        }
    }

    private void saveLastAutoRunDate(LocalDate date) {
        try {
            systemConfigRepository.findByConfigKey(KEY_LAST_AUTO_RUN).ifPresentOrElse(
                    config -> {
                        config.setConfigValue(date.toString());
                        systemConfigRepository.save(config);
                    },
                    () -> {
                        com.sep490_g47.smosp.admin.entity.SystemConfig newConfig =
                                com.sep490_g47.smosp.admin.entity.SystemConfig.builder()
                                        .configKey(KEY_LAST_AUTO_RUN)
                                        .configValue(date.toString())
                                        .description("Ngày chạy cào dữ liệu tự động gần nhất (YYYY-MM-DD). Được cập nhật tự động bởi CrawlScheduler.")
                                        .build();
                        systemConfigRepository.save(newConfig);
                    }
            );
        } catch (Exception e) {
            log.error("[CrawlScheduler] Không ghi được mốc crawler_last_auto_run", e);
        }
    }
}
