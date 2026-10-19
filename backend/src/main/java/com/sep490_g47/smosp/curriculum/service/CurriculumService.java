package com.sep490_g47.smosp.curriculum.service;

import com.sep490_g47.smosp.curriculum.dto.request.CurriculumRequest;
import com.sep490_g47.smosp.curriculum.dto.response.CurriculumResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface CurriculumService {
    CurriculumResponse createCurriculum(CurriculumRequest request);
    CurriculumResponse updateCurriculum(UUID id, CurriculumRequest request);
    void deleteCurriculum(UUID id);
    CurriculumResponse getCurriculumById(UUID id);
    Page<CurriculumResponse> getCurriculums(UUID specializationId, String curriculumCode, Pageable pageable);
    List<CurriculumResponse> getCurriculumsBySpecialization(UUID specializationId);
}
