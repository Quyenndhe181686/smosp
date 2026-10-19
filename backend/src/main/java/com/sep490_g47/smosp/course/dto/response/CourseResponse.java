package com.sep490_g47.smosp.course.dto.response;

import lombok.Data;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.util.UUID;
import java.util.Set;

@Data
@SuperBuilder
public class CourseResponse extends BaseResponse {
    private UUID id;
    private String code;
    private String name;
    private Integer credits;
    private String description;
    private Boolean countsTowardGpa;
    private Boolean isActive;
    private Set<String> prerequisiteCodes;
    private Integer resourceCount;
}
