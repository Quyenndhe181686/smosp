package com.sep490_g47.smosp.course.dto.response;

import lombok.Data;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.util.List;
import java.util.UUID;

@Data
@SuperBuilder
public class CourseDetailResponse extends BaseResponse {
    private UUID id;
    private String code;
    private String name;
    private Integer credits;
    private String description;
    private Boolean countsTowardGpa;
    private Boolean isActive;
    private List<UUID> specializationIds;
    private List<List<CourseResponse>> prerequisiteGroups;
    private List<LearningResourceResponse> learningResources;
}
