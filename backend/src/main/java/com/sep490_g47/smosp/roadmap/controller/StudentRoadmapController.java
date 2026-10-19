package com.sep490_g47.smosp.roadmap.controller;

import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import com.sep490_g47.smosp.roadmap.dto.request.*;
import com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapDetailResponse;
import com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapSummaryResponse;
import com.sep490_g47.smosp.roadmap.service.StudentRoadmapService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/students/me/roadmaps")
@RequiredArgsConstructor
public class StudentRoadmapController {

    private final StudentRoadmapService studentRoadmapService;

    @GetMapping
    public List<PersonalRoadmapSummaryResponse> getMyRoadmaps(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return studentRoadmapService.getMyRoadmaps(userDetails.getUserId());
    }

    @PostMapping
    public PersonalRoadmapSummaryResponse cloneRoadmap(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CloneRoadmapRequest request) {
        return studentRoadmapService.cloneRoadmap(userDetails.getUserId(), request);
    }

    @GetMapping("/{id}")
    public PersonalRoadmapDetailResponse getRoadmapDetail(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id) {
        return studentRoadmapService.getRoadmapDetail(userDetails.getUserId(), id);
    }

    @PutMapping("/{id}")
    public PersonalRoadmapSummaryResponse renameRoadmap(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody RenameRoadmapRequest request) {
        return studentRoadmapService.renameRoadmap(userDetails.getUserId(), id, request);
    }

    @DeleteMapping("/{id}")
    public void deleteRoadmap(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id) {
        studentRoadmapService.deleteRoadmap(userDetails.getUserId(), id);
    }

    @PostMapping("/{id}/sync-transcript")
    public void syncTranscript(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id) {
        studentRoadmapService.syncTranscript(userDetails.getUserId(), id);
    }

    @PatchMapping("/{id}/items/{courseId}/progress")
    public void updateProgress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId,
            @Valid @RequestBody UpdateProgressRequest request) {
        studentRoadmapService.updateProgress(userDetails.getUserId(), id, courseId, request);
    }

    @PutMapping("/{id}/items/{courseId}/grade")
    public void updateGrade(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId,
            @Valid @RequestBody UpdateGradeRequest request) {
        studentRoadmapService.updateGrade(userDetails.getUserId(), id, courseId, request);
    }

    @PostMapping("/{id}/bookmarks/{courseId}")
    public void addBookmark(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId) {
        studentRoadmapService.addBookmark(userDetails.getUserId(), id, courseId);
    }

    @DeleteMapping("/{id}/bookmarks/{courseId}")
    public void removeBookmark(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId) {
        studentRoadmapService.removeBookmark(userDetails.getUserId(), id, courseId);
    }

    @PutMapping("/{id}/notes/{courseId}")
    public void updateNote(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId,
            @Valid @RequestBody UpdateNoteRequest request) {
        studentRoadmapService.updateNote(userDetails.getUserId(), id, courseId, request);
    }

    @DeleteMapping("/{id}/notes/{courseId}")
    public void removeNote(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId) {
        studentRoadmapService.removeNote(userDetails.getUserId(), id, courseId);
    }

    @PatchMapping("/{id}/items/reorder")
    public void reorderItems(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody ReorderRoadmapItemsRequest request) {
        studentRoadmapService.reorderTermItems(userDetails.getUserId(), id, request);
    }

    @PatchMapping("/{id}/items/batch-reorder")
    public void batchReorderItems(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody BatchReorderRequest request) {
        studentRoadmapService.batchReorderTermItems(userDetails.getUserId(), id, request);
    }

    @PostMapping("/{id}/items/{courseId}/resources/file")
    public com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapResourceResponse uploadResourceFile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "resourceType", required = false, defaultValue = "DOCS") String resourceType,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return studentRoadmapService.uploadPersonalResourceFile(userDetails.getUserId(), id, courseId, title, resourceType, file);
    }

    @PostMapping("/{id}/items/{courseId}/resources/link")
    public com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapResourceResponse addResourceLink(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID courseId,
            @Valid @RequestBody AddPersonalResourceLinkRequest request) {
        return studentRoadmapService.addPersonalResourceLink(userDetails.getUserId(), id, courseId, request);
    }

    @DeleteMapping("/{id}/resources/{resourceId}")
    public void deleteResource(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable UUID id,
            @PathVariable UUID resourceId) {
        studentRoadmapService.deletePersonalResource(userDetails.getUserId(), id, resourceId);
    }
}

