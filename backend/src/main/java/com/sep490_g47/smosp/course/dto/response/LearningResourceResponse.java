package com.sep490_g47.smosp.course.dto.response;

import com.sep490_g47.smosp.course.enums.ResourceType;
import lombok.Data;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@SuperBuilder
public class LearningResourceResponse extends BaseResponse {
    private UUID id;
    private String title;
    private String url;
    private ResourceType resourceType;
    private Integer displayOrder;
}
