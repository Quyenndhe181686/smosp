package com.sep490_g47.smosp.catalog.controller;

import com.sep490_g47.smosp.catalog.dto.request.CatalogSearchRequest;
import com.sep490_g47.smosp.catalog.dto.response.CatalogSearchResponse;
import com.sep490_g47.smosp.catalog.dto.response.NarrowSpecDetailResponse;
import com.sep490_g47.smosp.catalog.service.PublicCatalogService;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.specialization.dto.response.SpecializationResponse;
import com.sep490_g47.smosp.major.dto.response.MajorResponse;
import com.sep490_g47.smosp.major.service.MajorService;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;
import com.sep490_g47.smosp.skill.service.SkillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PublicCatalogController {

    private final PublicCatalogService publicCatalogService;
    private final MajorService majorService;
    private final SkillService skillService;

    @GetMapping("/majors")
    public ResponseEntity<List<MajorResponse>> getAllMajors() {
        return ResponseEntity.ok(majorService.getAllMajors());
    }

    @GetMapping("/majors/{id}/specializations")
    public ResponseEntity<List<SpecializationResponse>> getSpecializationsByMajor(@PathVariable UUID id) {
        return ResponseEntity.ok(publicCatalogService.getSpecializationsByMajor(id));
    }

    @GetMapping("/specializations/{id}/narrow-specs")
    public ResponseEntity<List<NarrowSpecResponse>> getNarrowSpecsBySpecialization(@PathVariable UUID id) {
        return ResponseEntity.ok(publicCatalogService.getNarrowSpecsBySpecialization(id));
    }

    @GetMapping("/narrow-specs/{id}")
    public ResponseEntity<NarrowSpecDetailResponse> getNarrowSpecDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(publicCatalogService.getNarrowSpecDetail(id));
    }

    @PostMapping("/catalog/search")
    public ResponseEntity<CatalogSearchResponse> searchCatalog(@RequestBody CatalogSearchRequest request) {
        return ResponseEntity.ok(publicCatalogService.searchCatalog(request));
    }

    @GetMapping("/specializations/{id}/skills")
    public ResponseEntity<List<SkillResponse>> getSpecializationSkills(@PathVariable UUID id) {
        List<SkillResponse> activeSkills = skillService.getSpecializationSkills(id).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(activeSkills);
    }
}
