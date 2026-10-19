package com.sep490_g47.smosp.skill.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class SkillAliasUpdateRequest {
    @NotNull(message = "aliases list is required")
    private List<String> aliases;
}
