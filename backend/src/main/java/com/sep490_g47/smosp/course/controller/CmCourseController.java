package com.sep490_g47.smosp.course.controller;

import com.sep490_g47.smosp.course.dto.response.CourseDetailResponse;
import com.sep490_g47.smosp.course.dto.request.CourseRequest;
import com.sep490_g47.smosp.course.dto.response.CourseResponse;
import com.sep490_g47.smosp.course.dto.response.LearningResourceResponse;
import com.sep490_g47.smosp.course.enums.ResourceType;
import com.sep490_g47.smosp.course.service.CourseService;
import com.sep490_g47.smosp.course.service.LearningResourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
public class CmCourseController {

    private final CourseService courseService;
    private final LearningResourceService learningResourceService;

    @GetMapping
    public ResponseEntity<Page<CourseResponse>> getCourses(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) Boolean countsTowardGpa,
            @ParameterObject @PageableDefault(sort = "code") Pageable pageable) {
        return ResponseEntity.ok(courseService.getCourses(code, name, isActive, countsTowardGpa, pageable));
    }

    @PostMapping
    public ResponseEntity<CourseResponse> createCourse(@Valid @RequestBody CourseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(courseService.createCourse(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CourseResponse> updateCourse(@PathVariable UUID id, @Valid @RequestBody CourseRequest request) {
        return ResponseEntity.ok(courseService.updateCourse(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCourse(@PathVariable UUID id) {
        courseService.deleteCourse(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/prerequisites")
    public ResponseEntity<CourseDetailResponse> updatePrerequisites(@PathVariable UUID id, @RequestBody List<List<UUID>> prerequisiteGroups) {
        return ResponseEntity.ok(courseService.updatePrerequisites(id, prerequisiteGroups));
    }

    @PostMapping(value = "/{id}/resources", consumes = "multipart/form-data")
    public ResponseEntity<LearningResourceResponse> uploadResource(
            @PathVariable UUID id,
            @RequestParam("title") String title,
            @RequestParam("resourceType") ResourceType resourceType,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "linkUrl", required = false) String linkUrl) {
        
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(learningResourceService.uploadResource(id, title, resourceType, file, linkUrl));
    }

    @PutMapping("/{id}/resources/order")
    public ResponseEntity<Void> updateResourceOrder(
            @PathVariable UUID id,
            @RequestBody java.util.Map<UUID, Integer> orderMap) {
        learningResourceService.updateResourceOrder(id, orderMap);
        return ResponseEntity.ok().build();
    }
}
