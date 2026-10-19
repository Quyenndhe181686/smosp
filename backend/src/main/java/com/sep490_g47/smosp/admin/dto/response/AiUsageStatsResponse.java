package com.sep490_g47.smosp.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiUsageStatsResponse {
    private long totalTokens;
    /** Hạn mức token mỗi tháng, lấy từ system config ai_token_quota. */
    private long quotaTokens;
    private Map<String, Long> tokensByPurpose;
    private LocalDateTime since;
    /** Mức tiêu thụ token của các tháng gần nhất, cũ → mới. */
    private List<MonthlyTokenUsage> monthlyUsage;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MonthlyTokenUsage {
        private int year;
        private int month;
        /** Nhãn hiển thị dạng MM/yyyy, backend tính sẵn để frontend không phải suy luận. */
        private String label;
        private long tokens;
    }
}
