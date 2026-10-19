package com.sep490_g47.smosp.transcript.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import com.sep490_g47.smosp.transcript.entity.CourseGradeStatus;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentCourseGradeResponse extends BaseResponse {
    private UUID id;
    private UUID courseId;
    private String courseCodeRaw;
    private String courseCode;
    private String courseName;
    private Integer credits;
    private Integer term;
    private Boolean countsTowardGpa;
    private BigDecimal grade;
    private CourseGradeStatus status;
}
