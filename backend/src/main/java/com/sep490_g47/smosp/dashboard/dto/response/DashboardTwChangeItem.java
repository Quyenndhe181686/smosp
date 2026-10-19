package com.sep490_g47.smosp.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Đề xuất Trending Weight đã duyệt và làm thay đổi trọng số thực tế. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardTwChangeItem {
    private UUID proposalId;
    private UUID nsId;
    private String nsCode;
    private String nsName;
    private UUID specId;
    private UUID majorId;
    private BigDecimal before;
    private BigDecimal after;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
}
