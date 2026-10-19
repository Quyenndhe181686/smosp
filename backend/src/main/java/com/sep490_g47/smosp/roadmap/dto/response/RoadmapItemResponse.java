package com.sep490_g47.smosp.roadmap.dto.response;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoadmapItemResponse {
    private UUID courseId;
    private String code;
    private String name;
    private Integer credits;
    private String courseType; // from CourseType enum
    private List<List<UUID>> prerequisiteGroups;
    private Boolean countsTowardGpa;
}
