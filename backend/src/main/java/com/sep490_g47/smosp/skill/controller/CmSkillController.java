package com.sep490_g47.smosp.skill.controller;

import com.sep490_g47.smosp.skill.dto.request.SkillAliasUpdateRequest;
import com.sep490_g47.smosp.skill.dto.request.SkillCourseMapRequest;
import com.sep490_g47.smosp.skill.dto.request.SkillRequest;
import com.sep490_g47.smosp.skill.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;
import com.sep490_g47.smosp.skill.service.SkillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cm")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
public class CmSkillController {

    private final SkillService skillService;

    @GetMapping("/specializations/{id}/skills")
    public ResponseEntity<List<SkillResponse>> getSpecializationSkills(@PathVariable UUID id) {
        return ResponseEntity.ok(skillService.getSpecializationSkills(id));
    }

    @PostMapping("/skills")
    public ResponseEntity<SkillResponse> createSkill(@Valid @RequestBody SkillRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(skillService.createSkill(request));
    }

    @PutMapping("/skills/{id}")
    public ResponseEntity<SkillResponse> updateSkill(
            @PathVariable UUID id,
            @Valid @RequestBody SkillRequest request) {
        return ResponseEntity.ok(skillService.updateSkill(id, request));
    }

    @PatchMapping("/skills/{id}/status")
    public ResponseEntity<SkillResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody StatusUpdateRequest request) {
        return ResponseEntity.ok(skillService.updateStatus(id, request));
    }

    @PutMapping("/skills/{id}/aliases")
    public ResponseEntity<SkillResponse> updateAliases(
            @PathVariable UUID id,
            @Valid @RequestBody SkillAliasUpdateRequest request) {
        return ResponseEntity.ok(skillService.updateAliases(id, request));
    }

    @PutMapping("/skills/{id}/course-map")
    public ResponseEntity<SkillResponse> updateCourseMap(
            @PathVariable UUID id,
            @Valid @RequestBody SkillCourseMapRequest request) {
        return ResponseEntity.ok(skillService.updateCourseMap(id, request));
    }
}
