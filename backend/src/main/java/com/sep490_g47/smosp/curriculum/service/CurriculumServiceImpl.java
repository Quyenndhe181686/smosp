package com.sep490_g47.smosp.curriculum.service;

import com.sep490_g47.smosp.curriculum.dto.request.CurriculumRequest;
import com.sep490_g47.smosp.curriculum.dto.response.CurriculumResponse;
import com.sep490_g47.smosp.curriculum.entity.Curriculum;
import com.sep490_g47.smosp.curriculum.repository.CurriculumRepository;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CurriculumServiceImpl implements CurriculumService {

    private final CurriculumRepository curriculumRepository;
    private final SpecializationRepository specializationRepository;

    @Override
    @Transactional
    public CurriculumResponse createCurriculum(CurriculumRequest request) {
        if (curriculumRepository.existsByCurriculumCode(request.getCurriculumCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Curriculum code already exists");
        }

        Specialization specialization = specializationRepository.findById(request.getSpecializationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));

        Curriculum curriculum = Curriculum.builder()
                .specialization(specialization)
                .externalCurId(request.getExternalCurId())
                .curriculumCode(request.getCurriculumCode())
                .batchCode(request.getBatchCode())
                .curriculumNameVi(request.getCurriculumNameVi())
                .curriculumNameEn(request.getCurriculumNameEn())
                .decisionNo(request.getDecisionNo())
                .decisionDate(request.getDecisionDate())
                .description(request.getDescription())
                .build();

        curriculum = curriculumRepository.save(curriculum);
        return mapToResponse(curriculum);
    }

    @Override
    @Transactional
    public CurriculumResponse updateCurriculum(UUID id, CurriculumRequest request) {
        Curriculum curriculum = curriculumRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curriculum not found"));

        if (curriculumRepository.existsByCurriculumCodeAndIdNot(request.getCurriculumCode(), id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Curriculum code already exists for another record");
        }

        Specialization specialization = specializationRepository.findById(request.getSpecializationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));

        curriculum.setSpecialization(specialization);
        curriculum.setExternalCurId(request.getExternalCurId());
        curriculum.setCurriculumCode(request.getCurriculumCode());
        curriculum.setBatchCode(request.getBatchCode());
        curriculum.setCurriculumNameVi(request.getCurriculumNameVi());
        curriculum.setCurriculumNameEn(request.getCurriculumNameEn());
        curriculum.setDecisionNo(request.getDecisionNo());
        curriculum.setDecisionDate(request.getDecisionDate());
        curriculum.setDescription(request.getDescription());

        curriculum = curriculumRepository.save(curriculum);
        return mapToResponse(curriculum);
    }

    @Override
    @Transactional
    public void deleteCurriculum(UUID id) {
        Curriculum curriculum = curriculumRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curriculum not found"));
        curriculumRepository.delete(curriculum);
    }

    @Override
    @Transactional(readOnly = true)
    public CurriculumResponse getCurriculumById(UUID id) {
        Curriculum curriculum = curriculumRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curriculum not found"));
        return mapToResponse(curriculum);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CurriculumResponse> getCurriculums(UUID specializationId, String curriculumCode, Pageable pageable) {
        Specification<Curriculum> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (specializationId != null) {
                predicates.add(cb.equal(root.get("specialization").get("id"), specializationId));
            }
            if (curriculumCode != null && !curriculumCode.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("curriculumCode")), "%" + curriculumCode.toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return curriculumRepository.findAll(spec, pageable).map(this::mapToResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CurriculumResponse> getCurriculumsBySpecialization(UUID specializationId) {
        return curriculumRepository.findBySpecialization_IdOrderByCurriculumCodeAsc(specializationId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private CurriculumResponse mapToResponse(Curriculum curriculum) {
        return CurriculumResponse.builder()
                .id(curriculum.getId())
                .specializationId(curriculum.getSpecialization() != null ? curriculum.getSpecialization().getId() : null)
                .specializationCode(curriculum.getSpecialization() != null ? curriculum.getSpecialization().getCode() : null)
                .specializationName(curriculum.getSpecialization() != null ? curriculum.getSpecialization().getName() : null)
                .externalCurId(curriculum.getExternalCurId())
                .curriculumCode(curriculum.getCurriculumCode())
                .batchCode(curriculum.getBatchCode())
                .curriculumNameVi(curriculum.getCurriculumNameVi())
                .curriculumNameEn(curriculum.getCurriculumNameEn())
                .decisionNo(curriculum.getDecisionNo())
                .decisionDate(curriculum.getDecisionDate())
                .description(curriculum.getDescription())
                .createdAt(curriculum.getCreatedAt())
                .updatedAt(curriculum.getUpdatedAt())
                .build();
    }
}
