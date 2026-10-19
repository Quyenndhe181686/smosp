package com.sep490_g47.smosp.specialization.dto.request;

import com.sep490_g47.smosp.course.enums.CourseType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SpecCourseRequest {

    @NotNull(message = "Course ID is required")
    private UUID courseId;

    @NotNull(message = "Term order is required")
    private Integer termOrder;

    @NotNull(message = "Course type is required")
    private CourseType courseType;
}
