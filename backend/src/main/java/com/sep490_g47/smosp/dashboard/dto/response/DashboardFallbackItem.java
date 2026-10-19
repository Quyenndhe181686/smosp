package com.sep490_g47.smosp.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** CNH đang chạy bằng hệ số dự phòng, hoặc không có dữ liệu thị trường mới. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardFallbackItem {
    private UUID nsId;
    private String nsCode;
    private String nsName;
    private UUID specId;
    private String specName;
    private UUID majorId;
    private String majorName;

    /** NEVER_CRAWLED | STALE_DATA | FALLBACK_COEFFICIENT — để UI tự chọn nhãn/màu. */
    private String reasonCode;

    /** null khi CNH chưa từng có đề xuất Trending Weight nào. */
    private Long daysSinceLastData;
}
