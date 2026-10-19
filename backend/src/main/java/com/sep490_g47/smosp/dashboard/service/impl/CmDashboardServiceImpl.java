package com.sep490_g47.smosp.dashboard.service.impl;

import com.sep490_g47.smosp.account.enums.ReportStatus;
import com.sep490_g47.smosp.account.repository.ContentErrorReportRepository;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.TrendingWeightProposalRepository;
import com.sep490_g47.smosp.dashboard.dto.response.CmDashboardResponse;
import com.sep490_g47.smosp.dashboard.dto.response.DashboardCourseGapItem;
import com.sep490_g47.smosp.dashboard.dto.response.DashboardFallbackItem;
import com.sep490_g47.smosp.dashboard.dto.response.DashboardNsGapItem;
import com.sep490_g47.smosp.dashboard.dto.response.DashboardTwChangeItem;
import com.sep490_g47.smosp.dashboard.dto.response.DashboardTwExpiringItem;
import com.sep490_g47.smosp.dashboard.service.CmDashboardService;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gom toàn bộ số liệu trang CM Dashboard.
 *
 * Nguyên tắc: mọi thứ ở đây phải là truy vấn set-based, số lượng query KHÔNG
 * phụ thuộc số ngành / chuyên ngành / CNH. Trang này trước đây được dựng ở
 * frontend bằng cách duyệt cây danh mục rồi gọi API cho từng CNH — chi phí
 * O(số CNH) request và làm treo trình duyệt.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CmDashboardServiceImpl implements CmDashboardService {

    /** Đề xuất Trending Weight quá hạn này mà chưa duyệt thì bị coi là hết hiệu lực. */
    private static final int APPROVAL_DEADLINE_DAYS = 7;

    /** Còn dưới ngần này ngày thì cảnh báo "sắp hết hạn duyệt". */
    private static final int NEAR_EXPIRY_DAYS = 3;

    /** Không có dữ liệu thị trường mới quá ngần này ngày thì coi là dữ liệu cũ (BV-36). */
    private static final int STALE_MARKET_DATA_DAYS = 30;

    /** Chênh lệch nhỏ hơn ngưỡng này coi như trọng số không đổi (nhiễu làm tròn). */
    private static final BigDecimal TW_CHANGE_EPSILON = new BigDecimal("0.001");

    private static final List<ReportStatus> OPEN_REPORT_STATUSES =
            List.of(ReportStatus.PENDING, ReportStatus.IN_PROGRESS);

    private final CourseRepository courseRepository;
    private final MajorRepository majorRepository;
    private final SpecializationRepository specializationRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final TrendingWeightProposalRepository proposalRepository;
    private final ContentErrorReportRepository errorReportRepository;
    private final CrawlBatchRepository crawlBatchRepository;

    @Override
    @Transactional(readOnly = true)
    public CmDashboardResponse getOverview() {
        LocalDateTime now = LocalDateTime.now();

        CmDashboardResponse.Totals totals = null;
        try { totals = buildTotals(); } catch (Exception e) { log.error("Failed to build totals", e); }

        CmDashboardResponse.Alerts alerts = null;
        try { alerts = buildAlerts(); } catch (Exception e) { log.error("Failed to build alerts", e); }

        List<DashboardNsGapItem> nsGaps = null;
        try { nsGaps = buildNsGaps(); } catch (Exception e) { log.error("Failed to build nsGaps", e); }

        List<DashboardCourseGapItem> courseGaps = null;
        try { courseGaps = buildCourseGaps(); } catch (Exception e) { log.error("Failed to build courseGaps", e); }

        List<DashboardTwExpiringItem> twExpiring = null;
        try { twExpiring = buildTwExpiring(now); } catch (Exception e) { log.error("Failed to build twExpiring", e); }

        List<DashboardFallbackItem> marketFallbacks = null;
        try { marketFallbacks = buildMarketFallbacks(now); } catch (Exception e) { log.error("Failed to build marketFallbacks", e); }

        CmDashboardResponse.TwApproved twApproved = null;
        try { twApproved = buildTwApproved(); } catch (Exception e) { log.error("Failed to build twApproved", e); }

        return CmDashboardResponse.builder()
                .totals(totals)
                .alerts(alerts)
                .nsGaps(nsGaps)
                .courseGaps(courseGaps)
                .twExpiring(twExpiring)
                .marketFallbacks(marketFallbacks)
                .twApproved(twApproved)
                .thresholds(CmDashboardResponse.Thresholds.builder()
                        .approvalDeadlineDays(APPROVAL_DEADLINE_DAYS)
                        .nearExpiryDays(NEAR_EXPIRY_DAYS)
                        .staleMarketDataDays(STALE_MARKET_DATA_DAYS)
                        .build())
                .build();
    }

    private CmDashboardResponse.Totals buildTotals() {
        return CmDashboardResponse.Totals.builder()
                .courses(courseRepository.count())
                .majors(majorRepository.count())
                .specializations(specializationRepository.count())
                .narrowSpecs(narrowSpecRepository.count())
                .build();
    }

    private CmDashboardResponse.Alerts buildAlerts() {
        return CmDashboardResponse.Alerts.builder()
                .pendingContentErrors(errorReportRepository.countByStatusIn(OPEN_REPORT_STATUSES))
                .runningCrawlBatches(crawlBatchRepository.countUnfinished())
                .build();
    }

    private List<DashboardNsGapItem> buildNsGaps() {
        List<DashboardNsGapItem> gaps = new ArrayList<>();
        for (Object[] row : narrowSpecRepository.findTagMapCoverage()) {
            boolean missingSkill = toLong(row[7]) == 0L;
            boolean missingInterest = toLong(row[8]) == 0L;
            if (!missingSkill && !missingInterest) {
                continue;
            }
            gaps.add(DashboardNsGapItem.builder()
                    .nsId((UUID) row[0])
                    .nsCode((String) row[1])
                    .nsName((String) row[2])
                    .specId((UUID) row[3])
                    .specName((String) row[4])
                    .majorId((UUID) row[5])
                    .majorName((String) row[6])
                    .missingSkill(missingSkill)
                    .missingInterest(missingInterest)
                    .build());
        }
        return gaps;
    }

    private List<DashboardCourseGapItem> buildCourseGaps() {
        List<DashboardCourseGapItem> gaps = new ArrayList<>();
        for (Object[] row : courseRepository.findCoursesWithoutSkill()) {
            gaps.add(DashboardCourseGapItem.builder()
                    .id((UUID) row[0])
                    .code((String) row[1])
                    .name((String) row[2])
                    .build());
        }
        return gaps;
    }

    private List<DashboardTwExpiringItem> buildTwExpiring(LocalDateTime now) {
        List<DashboardTwExpiringItem> items = new ArrayList<>();
        for (Object[] row : proposalRepository.findByStatusWithHierarchy(TrendingWeightProposalStatus.PENDING)) {
            LocalDateTime createdAt = (LocalDateTime) row[11];
            if (createdAt == null) {
                continue;
            }
            long daysLeft = daysLeftFrom(createdAt, now);
            if (daysLeft > NEAR_EXPIRY_DAYS) {
                continue;
            }
            items.add(DashboardTwExpiringItem.builder()
                    .proposalId((UUID) row[0])
                    .nsId((UUID) row[1])
                    .nsCode((String) row[2])
                    .nsName((String) row[3])
                    .specId((UUID) row[4])
                    .specName((String) row[5])
                    .majorId((UUID) row[6])
                    .majorName((String) row[7])
                    .currentValue((BigDecimal) row[8])
                    .proposedValue((BigDecimal) row[9])
                    .fallback(Boolean.TRUE.equals(row[10]))
                    .createdAt(createdAt)
                    .daysLeft(daysLeft)
                    .build());
        }
        items.sort(Comparator.comparingLong(DashboardTwExpiringItem::getDaysLeft));
        return items;
    }

    /**
     * Số ngày còn lại trước khi đề xuất hết hạn duyệt, làm tròn lên và chặn dưới ở
     * 0 — trùng công thức UI đang hiển thị cho CM.
     */
    private long daysLeftFrom(LocalDateTime createdAt, LocalDateTime now) {
        long elapsedMinutes = Duration.between(createdAt, now).toMinutes();
        long deadlineMinutes = (long) APPROVAL_DEADLINE_DAYS * 24 * 60;
        long remainingMinutes = deadlineMinutes - elapsedMinutes;
        if (remainingMinutes <= 0) {
            return 0L;
        }
        return (remainingMinutes + (24 * 60 - 1)) / (24 * 60);
    }

    /**
     * CNH đang thiếu nền tảng dữ liệu thị trường: chưa từng được tính trending
     * weight, lần tính gần nhất đã quá cũ, hoặc lần gần nhất phải rơi về hệ số dự
     * phòng vì lượng tin tuyển dụng dưới ngưỡng tin cậy.
     */
    private List<DashboardFallbackItem> buildMarketFallbacks(LocalDateTime now) {
        List<Object[]> recency = proposalRepository.findRecencyByNarrowSpec();

        // Query đã sắp theo (nsId, version DESC) nên bản ghi đầu tiên của mỗi nsId là
        // lần tính gần nhất; các bản ghi sau của cùng CNH bỏ qua.
        Map<UUID, Object[]> latestByNs = new HashMap<>();
        for (Object[] row : recency) {
            latestByNs.putIfAbsent((UUID) row[0], row);
        }

        // Lấy thời điểm crawl thành công gần nhất theo Chuyên ngành (hoặc toàn hệ thống)
        Map<UUID, LocalDateTime> latestSuccessBySpec = new HashMap<>();
        for (Object[] row : crawlBatchRepository.findLatestSuccessTimeBySpecialization()) {
            if (row[0] != null && row[1] != null) {
                latestSuccessBySpec.put((UUID) row[0], (LocalDateTime) row[1]);
            }
        }
        LocalDateTime globalSuccessTime = crawlBatchRepository.findLatestGlobalSuccessTime().orElse(null);

        List<DashboardFallbackItem> items = new ArrayList<>();
        for (Object[] ns : narrowSpecRepository.findAllWithHierarchy()) {
            UUID nsId = (UUID) ns[0];
            UUID specId = (UUID) ns[3];
            Object[] latest = latestByNs.get(nsId);

            // Mốc crawl thành công cuối theo BV-36: ưu tiên mốc của Chuyên ngành, nếu không có lấy toàn hệ thống
            LocalDateTime specCrawlTime = latestSuccessBySpec.get(specId);
            LocalDateTime lastCrawlSuccessAt = specCrawlTime != null ? specCrawlTime : globalSuccessTime;

            String reasonCode;
            Long daysSince = null;

            if (latest == null && lastCrawlSuccessAt == null) {
                reasonCode = "NEVER_CRAWLED";
            } else {
                // BV-36: đo số ngày kể từ mẻ crawl thành công cuối; nếu không có mẻ crawl riêng thì dùng createdAt của proposal
                LocalDateTime baseTime = lastCrawlSuccessAt;
                if (baseTime == null && latest != null) {
                    baseTime = (LocalDateTime) latest[2];
                }

                boolean isFallback = latest != null && Boolean.TRUE.equals(latest[3]);
                daysSince = baseTime == null ? null : Duration.between(baseTime, now).toDays();

                if (daysSince == null || daysSince >= STALE_MARKET_DATA_DAYS) {
                    reasonCode = "STALE_DATA";
                } else if (isFallback) {
                    reasonCode = "FALLBACK_COEFFICIENT";
                } else {
                    continue; // dữ liệu mới và không phải fallback → không cảnh báo
                }
            }

            items.add(DashboardFallbackItem.builder()
                    .nsId(nsId)
                    .nsCode((String) ns[1])
                    .nsName((String) ns[2])
                    .specId(specId)
                    .specName((String) ns[4])
                    .majorId((UUID) ns[5])
                    .majorName((String) ns[6])
                    .reasonCode(reasonCode)
                    .daysSinceLastData(daysSince)
                    .build());
        }
        return items;
    }

    private CmDashboardResponse.TwApproved buildTwApproved() {
        List<Object[]> accepted = proposalRepository.findByStatusWithHierarchy(TrendingWeightProposalStatus.ACCEPTED);

        List<DashboardTwChangeItem> changes = new ArrayList<>();
        for (Object[] row : accepted) {
            BigDecimal before = (BigDecimal) row[8];
            BigDecimal after = (BigDecimal) row[9];
            if (before == null || after == null) {
                continue;
            }
            if (after.subtract(before).abs().compareTo(TW_CHANGE_EPSILON) <= 0) {
                continue;
            }
            changes.add(DashboardTwChangeItem.builder()
                    .proposalId((UUID) row[0])
                    .nsId((UUID) row[1])
                    .nsCode((String) row[2])
                    .nsName((String) row[3])
                    .specId((UUID) row[4])
                    .majorId((UUID) row[6])
                    .before(before)
                    .after(after)
                    .createdAt((LocalDateTime) row[11])
                    .reviewedAt((LocalDateTime) row[12])
                    .build());
        }

        return CmDashboardResponse.TwApproved.builder()
                .approvedCount(accepted.size())
                .changedCount(changes.size())
                .changes(changes)
                .build();
    }

    private long toLong(Object value) {
        return value instanceof Number ? ((Number) value).longValue() : 0L;
    }
}
