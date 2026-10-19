package com.sep490_g47.smosp.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** CNH còn thiếu ánh xạ Kỹ năng và/hoặc Sở thích trong Tag Map. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardNsGapItem {
    private UUID nsId;
    private String nsCode;
    private String nsName;
    private UUID specId;
    private String specName;
    private UUID majorId;
    private String majorName;
    private boolean missingSkill;
    private boolean missingInterest;
}
