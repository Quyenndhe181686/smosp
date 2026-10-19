package com.sep490_g47.smosp.skill.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SkillCourseMapRequest {
    @NotNull(message = "courseIds list is required")
    private List<UUID> courseIds;
}
