package com.sep490_g47.smosp.curriculum.controller;

import com.sep490_g47.smosp.curriculum.dto.request.CurriculumRequest;
import com.sep490_g47.smosp.curriculum.dto.response.CurriculumResponse;
import com.sep490_g47.smosp.curriculum.service.CurriculumService;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/curriculums")
@RequiredArgsConstructor
public class CmCurriculumController {

    private final CurriculumService curriculumService;

    @GetMapping
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<Page<CurriculumResponse>> getCurriculums(
            @RequestParam(required = false) UUID specializationId,
            @RequestParam(required = false) String curriculumCode,
            @ParameterObject @PageableDefault(sort = "curriculumCode") Pageable pageable) {
        return ResponseEntity.ok(curriculumService.getCurriculums(specializationId, curriculumCode, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<CurriculumResponse> getCurriculumById(@PathVariable UUID id) {
        return ResponseEntity.ok(curriculumService.getCurriculumById(id));
    }

    @GetMapping("/specialization/{specializationId}")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<List<CurriculumResponse>> getCurriculumsBySpecialization(@PathVariable UUID specializationId) {
        return ResponseEntity.ok(curriculumService.getCurriculumsBySpecialization(specializationId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public ResponseEntity<CurriculumResponse> createCurriculum(@Valid @RequestBody CurriculumRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(curriculumService.createCurriculum(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public ResponseEntity<CurriculumResponse> updateCurriculum(@PathVariable UUID id, @Valid @RequestBody CurriculumRequest request) {
        return ResponseEntity.ok(curriculumService.updateCurriculum(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public ResponseEntity<Void> deleteCurriculum(@PathVariable UUID id) {
        curriculumService.deleteCurriculum(id);
        return ResponseEntity.noContent().build();
    }
}
