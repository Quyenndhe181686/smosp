package com.sep490_g47.smosp.specialization.service;

import com.sep490_g47.smosp.major.entity.Major;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.specialization.dto.request.SpecCourseRequest;
import com.sep490_g47.smosp.specialization.dto.response.SpecCourseResponse;
import com.sep490_g47.smosp.specialization.dto.request.SpecializationRequest;
import com.sep490_g47.smosp.specialization.dto.response.SpecializationResponse;
import com.sep490_g47.smosp.specialization.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.specialization.entity.SpecCourse;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.entity.NsCourse;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository;
import com.sep490_g47.smosp.specialization.repository.SpecCourseRepository;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SpecializationServiceImpl implements SpecializationService {

    private final SpecializationRepository specializationRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final MajorRepository majorRepository;
    private final SpecCourseRepository specCourseRepository;
    private final CourseRepository courseRepository;
    private final NsCourseRepository nsCourseRepository;
    private final com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository crawlBatchRepository;

    @Override
    @Transactional
    public SpecializationResponse createSpecialization(SpecializationRequest request) {
        Major major = majorRepository.findById(request.getMajorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Major not found"));

        if (specializationRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specialization code already exists");
        }

        if (specializationRepository.existsByNameIgnoreCaseAndMajorId(request.getName(), request.getMajorId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specialization name already exists within this major");
        }

        if (specializationRepository.countByMajorId(request.getMajorId()) >= 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A Major can have a maximum of 10 Specializations");
        }

        Specialization specialization = Specialization.builder()
                .major(major)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .alphaBase(new BigDecimal("0.70"))
                .isActive(true)
                .build();

        specialization = specializationRepository.save(specialization);
        return mapToResponse(specialization);
    }

    @Override
    @Transactional
    public SpecializationResponse updateSpecialization(UUID id, SpecializationRequest request) {
        Specialization specialization = specializationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));

        Major major = majorRepository.findById(request.getMajorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Major not found"));

        if (!specialization.getCode().equals(request.getCode()) && specializationRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specialization code already exists");
        }

        if ((!specialization.getName().equalsIgnoreCase(request.getName()) || !specialization.getMajor().getId().equals(request.getMajorId()))
                && specializationRepository.existsByNameIgnoreCaseAndMajorId(request.getName(), request.getMajorId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specialization name already exists within this major");
        }

        // Re-check count if major changed
        if (!specialization.getMajor().getId().equals(request.getMajorId())) {
            if (specializationRepository.countByMajorId(request.getMajorId()) >= 10) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The target Major already has a maximum of 10 Specializations");
            }
        }

        specialization.setMajor(major);
        specialization.setCode(request.getCode());
        specialization.setName(request.getName());
        specialization.setDescription(request.getDescription());

        specialization = specializationRepository.save(specialization);
        return mapToResponse(specialization);
    }

    @Override
    @Transactional
    public SpecializationResponse updateStatus(UUID id, StatusUpdateRequest request) {
        Specialization specialization = specializationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));

        if (specialization.getIsActive().equals(request.getIsActive())) {
            return mapToResponse(specialization);
        }

        if (!request.getIsActive()) {
            // Chặn tắt khi Chuyên ngành đang có phiên crawl chạy dở.
            //
            // Tắt giữa chừng không dừng được luồng cào (nó đã nạp kế hoạch từ đầu và
            // không đọc lại isActive), nên phiên vẫn chạy tới hết rồi tự normalize và
            // tính lại trending weight — sinh đầy đủ dữ liệu cho một Chuyên ngành lẽ
            // ra đã bị ẩn. Bắt dừng phiên trước rồi mới tắt thì trạng thái luôn nhất
            // quán. Nêu đích danh người đang giữ phiên để CM biết hỏi ai.
            crawlBatchRepository
                    .findFirstByStatusAndScopeSpecialization_IdOrderByStartedAtDesc("RUNNING", id)
                    .ifPresent(batch -> {
                        String owner = batch.getTriggeredBy() != null
                                ? (batch.getTriggeredBy().getDisplayName() != null
                                        && !batch.getTriggeredBy().getDisplayName().isBlank()
                                                ? batch.getTriggeredBy().getDisplayName()
                                                : batch.getTriggeredBy().getUsername())
                                : "một Content Manager";
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Chuyên ngành đang có phiên thu thập dữ liệu chạy dở do " + owner
                                        + " thực hiện. Hãy dừng phiên đó trước khi tắt Chuyên ngành.");
                    });

            boolean hasActiveChildren = narrowSpecRepository.existsBySpecializationIdAndIsPublishedTrue(id);
            if (hasActiveChildren) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate Specialization because it has active NarrowSpecializations");
            }
        }

        specialization.setIsActive(request.getIsActive());
        specialization = specializationRepository.save(specialization);
        return mapToResponse(specialization);
    }

    @Override
    public List<SpecCourseResponse> getSpecializationCourses(UUID specializationId) {
        if (!specializationRepository.existsById(specializationId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found");
        }
        return specCourseRepository.findBySpecializationId(specializationId).stream()
                .map(this::mapToSpecCourseResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<SpecCourseResponse> updateSpecializationCourses(UUID specializationId, List<SpecCourseRequest> requests) {
        Specialization specialization = specializationRepository.findById(specializationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));

        List<UUID> incomingCourseIds = requests.stream().map(SpecCourseRequest::getCourseId).collect(Collectors.toList());
        if (!incomingCourseIds.isEmpty()) {
            List<NarrowSpecialization> childNarrowSpecs = narrowSpecRepository.findBySpecializationId(specializationId);
            if (!childNarrowSpecs.isEmpty()) {
                List<UUID> narrowSpecIds = childNarrowSpecs.stream().map(NarrowSpecialization::getId).collect(Collectors.toList());
                List<NsCourse> overlappingCourses = nsCourseRepository.findByNarrowSpecIdInAndCourseIdIn(narrowSpecIds, incomingCourseIds);
                if (!overlappingCourses.isEmpty()) {
                    String overlappingCode = overlappingCourses.get(0).getCourse().getCode();
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                        "Conflict: Course " + overlappingCode + " is already assigned to a child Narrow Specialization. Please remove it from the Narrow Specialization first before promoting it to a Core/General course.");
                }
            }
        }

        specCourseRepository.deleteBySpecializationId(specializationId);
        specCourseRepository.flush();

        List<SpecCourse> specCourses = requests.stream().map(req -> {
            Course course = courseRepository.findById(req.getCourseId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found with id: " + req.getCourseId()));

            // NAC-45-04: đối xứng với NAC-46-05 ở NarrowSpecServiceImpl — môn đã
            // ngừng hoạt động không được đưa vào cấu hình MỚI, dù vẫn xem được qua
            // link trực tiếp.
            if (Boolean.FALSE.equals(course.getIsActive())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Course is inactive and cannot be added: " + course.getCode());
            }

            return SpecCourse.builder()
                    .specialization(specialization)
                    .course(course)
                    .termOrder(req.getTermOrder())
                    .courseType(req.getCourseType())
                    .build();
        }).collect(Collectors.toList());

        Map<Integer, Integer> termCredits = new HashMap<>();
        for (SpecCourse sc : specCourses) {
            if (sc.getTermOrder() != null && sc.getCourse() != null && sc.getCourse().getCredits() != null) {
                termCredits.merge(sc.getTermOrder(), sc.getCourse().getCredits(), Integer::sum);
            }
        }
        for (Map.Entry<Integer, Integer> entry : termCredits.entrySet()) {
            if (entry.getValue() > 20) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "BV-19: Học kỳ " + entry.getKey() + " vượt quá 20 tín chỉ (hiện có " + entry.getValue() + " tín chỉ)");
            }
        }

        List<SpecCourse> savedCourses = specCourseRepository.saveAll(specCourses);
        return savedCourses.stream().map(this::mapToSpecCourseResponse).collect(Collectors.toList());
    }

    private SpecCourseResponse mapToSpecCourseResponse(SpecCourse specCourse) {
        return SpecCourseResponse.builder()
                .id(specCourse.getId())
                .courseId(specCourse.getCourse().getId())
                .courseCode(specCourse.getCourse().getCode())
                .courseName(specCourse.getCourse().getName())
                .termOrder(specCourse.getTermOrder())
                .courseType(specCourse.getCourseType())
                .build();
    }

    private SpecializationResponse mapToResponse(Specialization specialization) {
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
}
