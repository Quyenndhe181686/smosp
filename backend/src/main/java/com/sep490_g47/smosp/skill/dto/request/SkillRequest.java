package com.sep490_g47.smosp.skill.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SkillRequest {
    @NotNull(message = "specializationId is required")
    private UUID specializationId;

    @NotBlank(message = "name is required")
    private String name;
}
