package com.sep490_g47.smosp.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemStatsResponse {
    private Map<String, Long> usersByRole;
    private Map<String, Long> usersByStatus;
    private long totalMajorsActive;
    private long totalSpecsActive;
    private long totalNarrowSpecsPublished;
    private String lastCrawlBatchStatus;
    private LocalDateTime lastCrawlFinishedAt;
    private long pendingTwProposals;
    private long approvedTwProposals;
    private long rejectedTwProposals;
    private long totalTwProposals;
    private long totalStudents;
    private long aiTokensThisMonth;
}
