package com.sep490_g47.smosp.narrowspec.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.sep490_g47.smosp.course.dto.response.CourseResponse;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NsExcludedCourseResponse {
    private UUID id;
    private CourseResponse course;
    private String note;
}
