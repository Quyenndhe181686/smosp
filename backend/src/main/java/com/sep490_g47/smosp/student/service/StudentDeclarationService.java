package com.sep490_g47.smosp.student.service;

import com.sep490_g47.smosp.interest.dto.response.InterestOptionResponse;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;

import java.util.List;
import java.util.UUID;

public interface StudentDeclarationService {

    List<SkillResponse> getSkillOptions(UUID userId);

    List<SkillResponse> searchSkillOptions(UUID userId, String keyword);

    List<SkillResponse> getSkillSuggestions(UUID userId);

    List<SkillResponse> getDeclaredSkills(UUID userId);

    List<SkillResponse> updateDeclaredSkills(UUID userId, List<UUID> skillIds);

    List<InterestOptionResponse> getInterestOptions(UUID userId);

    List<InterestOptionResponse> getDeclaredInterests(UUID userId);

    List<InterestOptionResponse> updateDeclaredInterests(UUID userId, List<UUID> interestOptionIds);
}
