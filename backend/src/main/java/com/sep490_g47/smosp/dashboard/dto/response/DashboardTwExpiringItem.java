package com.sep490_g47.smosp.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Đề xuất Trending Weight sắp hết hạn duyệt (tính từ createdAt). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardTwExpiringItem {
    private UUID proposalId;
    private UUID nsId;
    private String nsCode;
    private String nsName;
    private UUID specId;
    private String specName;
    private UUID majorId;
    private String majorName;
    private BigDecimal currentValue;
    private BigDecimal proposedValue;
    private boolean fallback;
    private LocalDateTime createdAt;
    private long daysLeft;
}
