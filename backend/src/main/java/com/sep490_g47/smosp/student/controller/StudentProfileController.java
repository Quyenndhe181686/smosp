package com.sep490_g47.smosp.student.controller;

import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import com.sep490_g47.smosp.student.dto.response.StudentProfileResponse;
import com.sep490_g47.smosp.student.dto.request.UpdateStudentProfileRequest;
import com.sep490_g47.smosp.student.service.StudentDeclarationService;
import com.sep490_g47.smosp.student.service.StudentProfileService;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;
import com.sep490_g47.smosp.interest.dto.response.InterestOptionResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/students/me")
@RequiredArgsConstructor
public class StudentProfileController {

    private final StudentProfileService studentProfileService;
    private final StudentDeclarationService studentDeclarationService;

    @GetMapping
    public ResponseEntity<StudentProfileResponse> getMyProfile(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(studentProfileService.getMyProfile(userDetails.getUserId()));
    }

    @PutMapping
    public ResponseEntity<StudentProfileResponse> updateMyProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody UpdateStudentProfileRequest request) {
        return ResponseEntity.ok(studentProfileService.updateMyProfile(userDetails.getUserId(), request));
    }

    // --- Skill Declarations ---

    @GetMapping("/skill-options")
    public ResponseEntity<List<SkillResponse>> getSkillOptions(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(studentDeclarationService.getSkillOptions(userDetails.getUserId()));
    }

    @GetMapping("/skill-options/search")
    public ResponseEntity<List<SkillResponse>> searchSkillOptions(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(name = "keyword", required = false) String keyword) {
        return ResponseEntity.ok(studentDeclarationService.searchSkillOptions(userDetails.getUserId(), keyword));
    }

    @GetMapping("/skill-suggestions")
    public ResponseEntity<List<SkillResponse>> getSkillSuggestions(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(studentDeclarationService.getSkillSuggestions(userDetails.getUserId()));
    }

    @GetMapping("/skills")
    public ResponseEntity<List<SkillResponse>> getDeclaredSkills(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(studentDeclarationService.getDeclaredSkills(userDetails.getUserId()));
    }

    @PutMapping("/skills")
    public ResponseEntity<List<SkillResponse>> updateDeclaredSkills(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody List<UUID> skillIds) {
        return ResponseEntity.ok(studentDeclarationService.updateDeclaredSkills(userDetails.getUserId(), skillIds));
    }

    // --- Interest Declarations ---

    @GetMapping("/interest-options")
    public ResponseEntity<List<InterestOptionResponse>> getInterestOptions(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(studentDeclarationService.getInterestOptions(userDetails.getUserId()));
    }

    @GetMapping("/interests")
    public ResponseEntity<List<InterestOptionResponse>> getDeclaredInterests(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(studentDeclarationService.getDeclaredInterests(userDetails.getUserId()));
    }

    @PutMapping("/interests")
    public ResponseEntity<List<InterestOptionResponse>> updateDeclaredInterests(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody List<UUID> interestOptionIds) {
        return ResponseEntity.ok(studentDeclarationService.updateDeclaredInterests(userDetails.getUserId(), interestOptionIds));
    }
}
