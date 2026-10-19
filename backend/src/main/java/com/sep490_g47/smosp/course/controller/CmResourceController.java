package com.sep490_g47.smosp.course.controller;

import com.sep490_g47.smosp.course.dto.response.LearningResourceResponse;
import com.sep490_g47.smosp.course.enums.ResourceType;
import com.sep490_g47.smosp.course.service.LearningResourceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.util.UUID;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
public class CmResourceController {

    private final LearningResourceService learningResourceService;

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LearningResourceResponse> updateResource(
            @PathVariable UUID id,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) ResourceType resourceType,
            @RequestParam(required = false) MultipartFile file,
            @RequestParam(required = false) String linkUrl,
            @RequestParam(required = false) Integer displayOrder) {
        LearningResourceResponse response = learningResourceService.updateResource(id, title, resourceType, file, linkUrl, displayOrder);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResource(@PathVariable UUID id) {
        learningResourceService.deleteResource(id);
        return ResponseEntity.noContent().build();
    }
}
