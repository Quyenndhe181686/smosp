package com.sep490_g47.smosp.narrowspec.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class NsCourseRequest {

    @NotNull(message = "Course ID is required")
    private UUID courseId;

    @NotNull(message = "Term order is required")
    private Integer termOrder;
}
