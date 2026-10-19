package com.sep490_g47.smosp.narrowspec.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NsCourseResponse {
    private UUID id;
    private UUID courseId;
    private String courseCode;
    private String courseName;
    private Integer termOrder;
}
