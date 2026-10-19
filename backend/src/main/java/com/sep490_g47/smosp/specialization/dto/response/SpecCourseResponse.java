package com.sep490_g47.smosp.specialization.dto.response;

import com.sep490_g47.smosp.course.enums.CourseType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpecCourseResponse {
    private UUID id;
    private UUID courseId;
    private String courseCode;
    private String courseName;
    private Integer termOrder;
    private CourseType courseType;
}
