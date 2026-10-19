package com.sep490_g47.smosp.dashboard.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Môn học chưa được gán kỹ năng rèn luyện nào. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardCourseGapItem {
    private UUID id;
    private String code;
    private String name;
}
