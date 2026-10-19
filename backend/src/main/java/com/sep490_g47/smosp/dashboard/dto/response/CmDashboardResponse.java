package com.sep490_g47.smosp.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Toàn bộ dữ liệu trang CM Dashboard trong MỘT response.
 *
 * Trước đây frontend tự dựng dashboard bằng cách duyệt cây danh mục
 * (majors → specializations → narrow specs) rồi gọi thêm tag-map /
 * weight-config / trending-weight-history cho TỪNG narrow spec — với vài chục
 * CNH là hàng trăm request HTTP, đủ để treo tab trình duyệt. Toàn bộ phần đó
 * giờ được tính bằng một số ít truy vấn set-based ở backend.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CmDashboardResponse {

    private Totals totals;
    private Alerts alerts;
    private List<DashboardNsGapItem> nsGaps;
    private List<DashboardCourseGapItem> courseGaps;
    private List<DashboardTwExpiringItem> twExpiring;
    private List<DashboardFallbackItem> marketFallbacks;
    private TwApproved twApproved;

    /** Ngưỡng nghiệp vụ backend đã dùng để tính, trả về để UI hiển thị nhất quán. */
    private Thresholds thresholds;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Totals {
        private long courses;
        private long majors;
        private long specializations;
        private long narrowSpecs;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Alerts {
        private long pendingContentErrors;
        private long runningCrawlBatches;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TwApproved {
        private long approvedCount;
        private long changedCount;
        private List<DashboardTwChangeItem> changes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Thresholds {
        private int approvalDeadlineDays;
        private int nearExpiryDays;
        private int staleMarketDataDays;
    }
}
