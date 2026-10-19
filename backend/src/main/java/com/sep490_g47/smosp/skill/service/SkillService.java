package com.sep490_g47.smosp.skill.service;

import com.sep490_g47.smosp.skill.dto.request.SkillAliasUpdateRequest;
import com.sep490_g47.smosp.skill.dto.request.SkillCourseMapRequest;
import com.sep490_g47.smosp.skill.dto.request.SkillRequest;
import com.sep490_g47.smosp.skill.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;

import java.util.List;
import java.util.UUID;

public interface SkillService {
    List<SkillResponse> getSpecializationSkills(UUID specializationId);
    SkillResponse createSkill(SkillRequest request);
    SkillResponse updateSkill(UUID id, SkillRequest request);
    SkillResponse updateStatus(UUID id, StatusUpdateRequest request);
    SkillResponse updateAliases(UUID id, SkillAliasUpdateRequest request);
    SkillResponse updateCourseMap(UUID id, SkillCourseMapRequest request);
}
