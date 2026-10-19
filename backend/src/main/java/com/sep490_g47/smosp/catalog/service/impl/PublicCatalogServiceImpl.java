package com.sep490_g47.smosp.catalog.service.impl;

import com.sep490_g47.smosp.catalog.dto.request.CatalogSearchRequest;
import com.sep490_g47.smosp.catalog.dto.response.CatalogSearchResponse;
import com.sep490_g47.smosp.catalog.dto.response.NarrowSpecDetailResponse;
import com.sep490_g47.smosp.catalog.service.PublicCatalogService;
import com.sep490_g47.smosp.major.dto.response.MajorResponse;
import com.sep490_g47.smosp.major.entity.Major;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.narrowspec.dto.response.NsCourseResponse;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.entity.NsCourse;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository;
import com.sep490_g47.smosp.specialization.dto.response.SpecializationResponse;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicCatalogServiceImpl implements PublicCatalogService {

    private final MajorRepository majorRepository;
    private final SpecializationRepository specializationRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final NsCourseRepository nsCourseRepository;

    private boolean isContentManagerOrAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_CONTENT_MANAGER"));
    }

    @Override
    public List<SpecializationResponse> getSpecializationsByMajor(UUID majorId) {
        List<Specialization> specializations;
        if (isContentManagerOrAdmin()) {
            specializations = specializationRepository.findByMajorId(majorId);
        } else {
            specializations = specializationRepository.findByMajorIdAndIsActiveTrue(majorId);
        }
        return specializations.stream().map(this::mapToSpecializationResponse).collect(Collectors.toList());
    }

    @Override
    public List<NarrowSpecResponse> getNarrowSpecsBySpecialization(UUID specializationId) {
        List<NarrowSpecialization> narrowSpecs;
        if (isContentManagerOrAdmin()) {
            narrowSpecs = narrowSpecRepository.findBySpecializationId(specializationId);
        } else {
            narrowSpecs = narrowSpecRepository.findBySpecializationIdAndIsPublishedTrue(specializationId);
        }
        return narrowSpecs.stream().map(this::mapToNarrowSpecResponse).collect(Collectors.toList());
    }

    @Override
    public NarrowSpecDetailResponse getNarrowSpecDetail(UUID id) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Narrow Specialization not found"));

        if (!isContentManagerOrAdmin() && !Boolean.TRUE.equals(narrowSpec.getIsPublished())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Narrow Specialization not found");
        }

        List<NsCourseResponse> courses = nsCourseRepository.findByNarrowSpecId(id).stream()
                .map(this::mapToNsCourseResponse)
                .collect(Collectors.toList());

        return NarrowSpecDetailResponse.builder()
                .id(narrowSpec.getId())
                .specializationId(narrowSpec.getSpecialization().getId())
                .code(narrowSpec.getCode())
                .name(narrowSpec.getName())
                .description(narrowSpec.getDescription())
                .isPublished(narrowSpec.getIsPublished())
                .publishedAt(narrowSpec.getPublishedAt())
                .courses(courses)
                .build();
    }

    @Override
    public CatalogSearchResponse searchCatalog(CatalogSearchRequest request) {
        String keyword = request.getKeyword() != null ? request.getKeyword().trim() : "";
        if (keyword.isEmpty()) {
            return CatalogSearchResponse.builder()
                    .majors(List.of())
                    .specializations(List.of())
                    .narrowSpecs(List.of())
                    .build();
        }

        List<Major> majors;
        List<Specialization> specs;
        List<NarrowSpecialization> narrowSpecs;

        if (isContentManagerOrAdmin()) {
            majors = majorRepository.searchByKeyword(keyword);
            specs = specializationRepository.searchByKeyword(keyword);
            narrowSpecs = narrowSpecRepository.searchByKeyword(keyword);
        } else {
            majors = majorRepository.searchByKeywordAndIsActiveTrue(keyword);
            specs = specializationRepository.searchByKeywordAndIsActiveTrue(keyword);
            narrowSpecs = narrowSpecRepository.searchByKeywordAndIsPublishedTrue(keyword);
        }

        return CatalogSearchResponse.builder()
                .majors(majors.stream().map(this::mapToMajorResponse).collect(Collectors.toList()))
                .specializations(specs.stream().map(this::mapToSpecializationResponse).collect(Collectors.toList()))
                .narrowSpecs(narrowSpecs.stream().map(this::mapToNarrowSpecResponse).collect(Collectors.toList()))
                .build();
    }

    private MajorResponse mapToMajorResponse(Major major) {
        return MajorResponse.builder()
                .id(major.getId())
                .code(major.getCode())
                .name(major.getName())
                .description(major.getDescription())
                .isActive(major.getIsActive())
                .createdAt(major.getCreatedAt())
                .updatedAt(major.getUpdatedAt())
                .build();
    }

    private SpecializationResponse mapToSpecializationResponse(Specialization specialization) {
        return SpecializationResponse.builder()
                .id(specialization.getId())
                .majorId(specialization.getMajor().getId())
                .code(specialization.getCode())
                .name(specialization.getName())
                .description(specialization.getDescription())
                .imageUrl(specialization.getImageUrl())
                .alphaBase(specialization.getAlphaBase())
                .isActive(specialization.getIsActive())
                .createdAt(specialization.getCreatedAt())
                .updatedAt(specialization.getUpdatedAt())
                .build();
    }

    private NarrowSpecResponse mapToNarrowSpecResponse(NarrowSpecialization entity) {
        return NarrowSpecResponse.builder()
                .id(entity.getId())
                .specializationId(entity.getSpecialization().getId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .isPublished(entity.getIsPublished())
                .publishedAt(entity.getPublishedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private NsCourseResponse mapToNsCourseResponse(NsCourse nsCourse) {
        return NsCourseResponse.builder()
                .id(nsCourse.getId())
                .courseId(nsCourse.getCourse().getId())
                .courseCode(nsCourse.getCourse().getCode())
                .courseName(nsCourse.getCourse().getName())
                .termOrder(nsCourse.getTermOrder())
                .build();
    }
}
