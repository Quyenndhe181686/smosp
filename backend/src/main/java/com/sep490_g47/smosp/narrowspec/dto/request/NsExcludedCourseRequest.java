package com.sep490_g47.smosp.narrowspec.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NsExcludedCourseRequest {
    private UUID courseId;
    private String note;
}
