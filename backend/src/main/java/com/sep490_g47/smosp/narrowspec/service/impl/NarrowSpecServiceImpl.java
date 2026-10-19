package com.sep490_g47.smosp.narrowspec.service.impl;

import com.sep490_g47.smosp.narrowspec.dto.request.NarrowSpecRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.NsCourseRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NsCourseResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.PublishRequest;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.entity.NsCourse;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository;
import com.sep490_g47.smosp.narrowspec.repository.NsExcludedCourseRepository;
import com.sep490_g47.smosp.narrowspec.entity.NsExcludedCourse;
import com.sep490_g47.smosp.narrowspec.dto.request.NsExcludedCourseRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NsExcludedCourseResponse;
import com.sep490_g47.smosp.course.dto.response.CourseResponse;
import com.sep490_g47.smosp.narrowspec.service.NarrowSpecService;
import com.sep490_g47.smosp.narrowspec.util.NarrowSpecConstants;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import com.sep490_g47.smosp.specialization.entity.SpecCourse;
import com.sep490_g47.smosp.specialization.repository.SpecCourseRepository;
import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.roadmap.entity.PersonalRoadmap;
import com.sep490_g47.smosp.roadmap.repository.PersonalRoadmapRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.ArrayList;

import com.sep490_g47.smosp.roadmap.dto.response.RoadmapResponse;
import com.sep490_g47.smosp.roadmap.dto.response.TermGroup;
import com.sep490_g47.smosp.roadmap.dto.response.RoadmapItemResponse;
import com.sep490_g47.smosp.course.entity.CoursePrerequisite;

@Service
@RequiredArgsConstructor
@Slf4j
public class NarrowSpecServiceImpl implements NarrowSpecService {

    private final NarrowSpecRepository narrowSpecRepository;
    private final SpecializationRepository specializationRepository;
    private final NsCourseRepository nsCourseRepository;
    private final CourseRepository courseRepository;
    private final SpecCourseRepository specCourseRepository;
    private final NsExcludedCourseRepository nsExcludedCourseRepository;
    private final PersonalRoadmapRepository personalRoadmapRepository;
    private final NotificationRepository notificationRepository;
    private final jakarta.persistence.EntityManager entityManager;

    @Override
    @Transactional
    public NarrowSpecResponse createNarrowSpec(NarrowSpecRequest request) {
        if (narrowSpecRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NarrowSpecConstants.ERROR_CODE_UNIQUE);
        }

        if (narrowSpecRepository.existsByNameIgnoreCaseAndSpecializationId(request.getName(), request.getSpecializationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NarrowSpecConstants.ERROR_NAME_UNIQUE);
        }

        Specialization specialization = specializationRepository.findById(request.getSpecializationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_SPEC_NOT_FOUND));

        long currentCount = narrowSpecRepository.countBySpecializationId(specialization.getId());
        if (currentCount >= NarrowSpecConstants.MAX_NARROW_SPECS_PER_SPEC) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NarrowSpecConstants.ERROR_MAX_LIMIT_REACHED);
        }

        NarrowSpecialization narrowSpec = NarrowSpecialization.builder()
                .specialization(specialization)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .isPublished(false)
                .publishedAt(null)
                .build();

        NarrowSpecialization saved = narrowSpecRepository.save(narrowSpec);

        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public NarrowSpecResponse updateNarrowSpec(UUID id, NarrowSpecRequest request) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND));

        if (narrowSpecRepository.existsByCodeAndIdNot(request.getCode(), id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NarrowSpecConstants.ERROR_CODE_UNIQUE);
        }

        if ((!narrowSpec.getName().equalsIgnoreCase(request.getName()) || !narrowSpec.getSpecialization().getId().equals(request.getSpecializationId()))
                && narrowSpecRepository.existsByNameIgnoreCaseAndSpecializationId(request.getName(), request.getSpecializationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NarrowSpecConstants.ERROR_NAME_UNIQUE);
        }

        if (!narrowSpec.getSpecialization().getId().equals(request.getSpecializationId())) {
            Specialization specialization = specializationRepository.findById(request.getSpecializationId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_SPEC_NOT_FOUND));
            
            // Check limit if changing specialization
            long currentCount = narrowSpecRepository.countBySpecializationId(specialization.getId());
            if (currentCount >= NarrowSpecConstants.MAX_NARROW_SPECS_PER_SPEC) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NarrowSpecConstants.ERROR_MAX_LIMIT_REACHED);
            }
            narrowSpec.setSpecialization(specialization);
        }

        narrowSpec.setCode(request.getCode());
        narrowSpec.setName(request.getName());
        narrowSpec.setDescription(request.getDescription());

        NarrowSpecialization updated = narrowSpecRepository.save(narrowSpec);

        return mapToResponse(updated);
    }

    @Override
    @Transactional
    public NarrowSpecResponse publishNarrowSpec(UUID id, PublishRequest request) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND));

        if (request.getIsPublished()) {
            if (!narrowSpec.getIsPublished()) {
                validateNarrowSpecForPublish(id);
                narrowSpec.setIsPublished(true);
                narrowSpec.setPublishedAt(LocalDateTime.now());
            }
        } else {
            if (narrowSpec.getIsPublished()) {
                narrowSpec.setIsPublished(false);
                // BR-25: báo cho sinh viên đã clone lộ trình từ NS này. Chỉ chạy ở
                // đúng lượt chuyển true -> false, nên gỡ công khai một NS vốn đã ẩn
                // sẵn thì không gửi gì.
                notifyStudentsOfUnpublish(narrowSpec);
            }
        }

        NarrowSpecialization updated = narrowSpecRepository.save(narrowSpec);
        return mapToResponse(updated);
    }

    /**
     * BR-25 — CM gỡ công khai một narrow spec thì mọi sinh viên đã clone lộ trình
     * từ nó phải được báo.
     *
     * Trước đây nhánh unpublish chỉ đảo cờ {@code isPublished}. Lộ trình của sinh
     * viên vẫn trỏ tới nội dung không còn công khai, và không ai biết để xử lý.
     *
     * Một thông báo cho mỗi lộ trình chứ không phải mỗi sinh viên: nếu một người
     * có hai lộ trình cùng clone từ NS này thì đó là hai thứ khác nhau cần xử lý
     * riêng, và {@code metadata.personalRoadmapId} cho phép frontend dẫn thẳng tới
     * đúng cái bị ảnh hưởng.
     *
     * Đối xứng với cách {@code ContentErrorReportServiceImpl.processReport()} báo
     * cho sinh viên khi CM xử lý báo cáo.
     */
    private void notifyStudentsOfUnpublish(NarrowSpecialization narrowSpec) {
        List<PersonalRoadmap> affected =
                personalRoadmapRepository.findByNarrowSpecId(narrowSpec.getId());
        if (affected.isEmpty()) {
            return;
        }

        for (PersonalRoadmap roadmap : affected) {
            UserAccount student = roadmap.getStudentProfile() != null
                    ? roadmap.getStudentProfile().getUserAccount()
                    : null;
            if (student == null) {
                // Lộ trình mồ côi — không có ai để báo. Bỏ qua nhưng không im lặng,
                // vì đây là dấu hiệu dữ liệu hỏng chứ không phải trạng thái bình thường.
                log.warn("[BR-25] Lo trinh {} khong tra duoc UserAccount — bo qua thong bao unpublish",
                        roadmap.getId());
                continue;
            }

            notificationRepository.save(Notification.builder()
                    .user(student)
                    .type("NARROW_SPEC_UNPUBLISHED")
                    .title("Chuyên ngành hẹp trong lộ trình của bạn đã bị gỡ công khai")
                    .body("Chuyên ngành hẹp \"" + narrowSpec.getName() + "\" không còn được công khai. "
                            + "Lộ trình \"" + roadmap.getName() + "\" bạn đã tạo từ chuyên ngành này vẫn giữ nguyên, "
                            + "nhưng nội dung có thể không còn được cập nhật. "
                            + "Hãy liên hệ cố vấn học tập nếu cần điều chỉnh.")
                    .metadata(Map.of(
                            "narrowSpecId", narrowSpec.getId().toString(),
                            "narrowSpecCode", narrowSpec.getCode(),
                            "personalRoadmapId", roadmap.getId().toString()))
                    .isRead(false)
                    .build());
        }

        log.info("[BR-25] Da gui {} thong bao unpublish cho narrow spec {}", affected.size(), narrowSpec.getCode());
    }

    private void validateNarrowSpecForPublish(UUID narrowSpecId) {
        List<NsCourse> nsCourses = nsCourseRepository.findByNarrowSpecId(narrowSpecId);
        Map<Integer, List<NsCourse>> coursesByTerm = new TreeMap<>();
        int totalCredits = 0;

        for (NsCourse nsCourse : nsCourses) {
            coursesByTerm.computeIfAbsent(nsCourse.getTermOrder(), k -> new ArrayList<>()).add(nsCourse);
            totalCredits += nsCourse.getCourse().getCredits();
        }

        Set<Integer> termOrders = coursesByTerm.keySet();
        if (!termOrders.equals(Set.of(5, 7, 8))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "BV-17: Narrow Specialization must have courses in exactly terms 5, 7, and 8");
        }

        int totalCourses = nsCourses.size();
        if (totalCourses < 5 || totalCourses > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "BV-18: Narrow Specialization must have 5-10 courses in total (current: " + totalCourses + ")");
        }

        for (Map.Entry<Integer, List<NsCourse>> entry : coursesByTerm.entrySet()) {
            List<NsCourse> termCourses = entry.getValue();
            if (termCourses.size() < 1 || termCourses.size() > 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "BV-17: Each term (5, 7, 8) must have 1-2 courses (term " + entry.getKey() + " has " + termCourses.size() + ")");
            }

            int termCredits = termCourses.stream().mapToInt(c -> c.getCourse().getCredits()).sum();
            if (termCredits < 10 || termCredits > 20) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "BV-19: Each term must have 10-20 credits (term " + entry.getKey() + " has " + termCredits + ")");
            }
        }
    }

    @Override
    public List<NsCourseResponse> getNarrowSpecCourses(UUID narrowSpecId) {
        if (!narrowSpecRepository.existsById(narrowSpecId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND);
        }
        return nsCourseRepository.findByNarrowSpecId(narrowSpecId).stream()
                .map(this::mapToNsCourseResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<NsCourseResponse> updateNarrowSpecCourses(UUID narrowSpecId, List<NsCourseRequest> requests) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND));

        List<UUID> incomingCourseIds = requests.stream().map(NsCourseRequest::getCourseId).collect(Collectors.toList());
        if (!incomingCourseIds.isEmpty()) {
            List<SpecCourse> overlappingCourses = specCourseRepository.findBySpecializationIdAndCourseIdIn(narrowSpec.getSpecialization().getId(), incomingCourseIds);
            if (!overlappingCourses.isEmpty()) {
                String overlappingCode = overlappingCourses.get(0).getCourse().getCode();
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                    "Conflict: Course " + overlappingCode + " is already defined as a Core/General course in the parent Specialization and cannot be added as a Narrow Specialization course.");
            }
        }

        nsCourseRepository.deleteByNarrowSpecId(narrowSpecId);
        nsCourseRepository.flush();

        List<NsCourse> nsCourses = requests.stream().map(req -> {
            if (!Set.of(5, 7, 8).contains(req.getTermOrder())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "BV-17: NS courses can only be assigned to terms 5, 7, or 8 (got term " + req.getTermOrder() + ")");
            }

            Course course = courseRepository.findById(req.getCourseId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found with id: " + req.getCourseId()));

            // NAC-46-05: môn đã ngừng hoạt động vẫn xem được qua link trực tiếp,
            // nhưng không được đưa vào cấu hình MỚI. Tách "ẩn khỏi khám phá mới"
            // khỏi "chặn truy cập trực tiếp" — mở rộng nguyên tắc đã có ở AC-42-03.
            if (Boolean.FALSE.equals(course.getIsActive())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Course is inactive and cannot be added: " + course.getCode());
            }

            return NsCourse.builder()
                    .narrowSpec(narrowSpec)
                    .course(course)
                    .termOrder(req.getTermOrder())
                    .build();
        }).collect(Collectors.toList());

        List<NsCourse> savedCourses = nsCourseRepository.saveAll(nsCourses);
        return savedCourses.stream().map(this::mapToNsCourseResponse).collect(Collectors.toList());
    }

    @Override
    public List<NsExcludedCourseResponse> getExcludedCourses(UUID narrowSpecId) {
        if (!narrowSpecRepository.existsById(narrowSpecId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND);
        }
        return nsExcludedCourseRepository.findByNarrowSpecId(narrowSpecId).stream()
                .map(this::mapToNsExcludedCourseResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<NsExcludedCourseResponse> updateExcludedCourses(UUID narrowSpecId, List<NsExcludedCourseRequest> requests) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND));

        List<UUID> incomingCourseIds = requests.stream().map(NsExcludedCourseRequest::getCourseId).collect(Collectors.toList());

        if (!incomingCourseIds.isEmpty()) {
            // Truoc day so specCourses.size() (tu nhien dedupe theo IN, moi row DB
            // chi khop 1 lan du courseId lap lai bao nhieu lan trong list) voi
            // incomingCourseIds.size() (con nguyen trung lap). Gui trung courseId
            // thi hai so nay lech NGAY CA KHI moi course deu hop le, va bao nham
            // ly do "must belong to curriculum" thay vi ly do that "trung lap".
            Set<UUID> distinctCourseIds = new java.util.HashSet<>(incomingCourseIds);
            if (distinctCourseIds.size() != incomingCourseIds.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request chứa courseId trùng lặp");
            }

            List<SpecCourse> specCourses = specCourseRepository.findBySpecializationIdAndCourseIdIn(narrowSpec.getSpecialization().getId(), incomingCourseIds);
            if (specCourses.size() != distinctCourseIds.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All excluded courses must belong to the parent Specialization's curriculum.");
            }

            // NOTE: Validation for overrides_course_id is skipped as there is no such field in the current database schema.
        }

        nsExcludedCourseRepository.deleteByNarrowSpecId(narrowSpecId);

        List<NsExcludedCourse> excludedCourses = requests.stream().map(req -> {
            Course course = courseRepository.findById(req.getCourseId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found with id: " + req.getCourseId()));
            return NsExcludedCourse.builder()
                    .narrowSpec(narrowSpec)
                    .course(course)
                    .note(req.getNote())
                    .build();
        }).collect(Collectors.toList());

        List<NsExcludedCourse> saved = nsExcludedCourseRepository.saveAll(excludedCourses);
        return saved.stream().map(this::mapToNsExcludedCourseResponse).collect(Collectors.toList());
    }

    @Override
    public RoadmapResponse getStandardRoadmap(UUID narrowSpecId) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NarrowSpecConstants.ERROR_NARROW_SPEC_NOT_FOUND));

        if (!narrowSpec.getIsPublished()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Narrow Specialization chưa được publish");
        }

        // BR-05: an khoi kham pha VA chan truy cap truc tiep, "ke ca truy cap truc
        // tiep qua URL". Truoc day chi kiem isPublished cua CHINH NarrowSpecialization
        // — mot NS van publish=true nhung Specialization/Major cha da bi Admin an
        // (isActive=false) van doc duoc trot lot neu biet thang id qua URL, du no
        // khong con hien trong bat ky danh sach nao nua.
        Specialization specialization = narrowSpec.getSpecialization();
        if (specialization == null || Boolean.FALSE.equals(specialization.getIsActive())
                || specialization.getMajor() == null || Boolean.FALSE.equals(specialization.getMajor().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Narrow Specialization chưa được publish");
        }

        List<NsExcludedCourse> excludedCourses = nsExcludedCourseRepository.findByNarrowSpecId(narrowSpecId);
        Set<UUID> excludedCourseIds = excludedCourses.stream().map(e -> e.getCourse().getId()).collect(Collectors.toSet());
        
        List<SpecCourse> specCourses = specCourseRepository.findBySpecializationId(narrowSpec.getSpecialization().getId());
        List<NsCourse> nsCourses = nsCourseRepository.findByNarrowSpecId(narrowSpecId);
        
        Map<Integer, List<RoadmapItemResponse>> termsMap = new TreeMap<>();
        
        // 1. Process SpecCourses (Terms 1-9)
        for (SpecCourse sc : specCourses) {
            int t = sc.getTermOrder();
            if (t <= 9) {  // Kỳ 1-9 đều lấy spec_course nếu có
                if (!excludedCourseIds.contains(sc.getCourse().getId())) {
                    termsMap.computeIfAbsent(t, k -> new ArrayList<>())
                            .add(mapToRoadmapItemResponse(sc.getCourse(), sc.getCourseType().name()));
                }
            }
        }
        
        // 2. Process NsCourses (chỉ kỳ 5, 7, 8)
        //
        // BV-17: NS chỉ được cấu hình môn ở đúng 3 kỳ 5/7/8. Kỳ 6 (OJT) và kỳ 9
        // (Đồ án tốt nghiệp) là system constant, thuộc SpecCourse chứ không phải
        // NsCourse — vòng lặp 1 ở trên đã lấy chúng rồi.
        //
        // updateNarrowSpecCourses() nay đã chặn ghi kỳ 6/9, nhưng đây là tầng đọc:
        // bản ghi NsCourse kỳ 6/9 tạo TRƯỚC khi có validate vẫn nằm trong DB và
        // vẫn hiện ra roadmap công khai. Khoá cửa rồi thì phải dọn nốt trong nhà.
        for (NsCourse nc : nsCourses) {
            int t = nc.getTermOrder();
            if (t == 5 || t == 7 || t == 8) {
                // Áp loại trừ y như vòng SpecCourse ở trên. NsExcludedCourse có khoá
                // unique (narrow_spec_id, course_id) và KHÔNG phân biệt course đến từ
                // SpecCourse hay NsCourse, nên không có lý do thiết kế nào để chỉ áp
                // một phía. Thiếu dòng này thì CM thêm course vào danh sách loại trừ,
                // hệ thống báo thành công, mà sinh viên vẫn thấy course đó trong
                // roadmap — và CM không có cách nào biết thao tác của mình vô tác dụng.
                if (excludedCourseIds.contains(nc.getCourse().getId())) {
                    continue;
                }
                // Ensure no duplicate course in the same term
                List<RoadmapItemResponse> termItems = termsMap.computeIfAbsent(t, k -> new ArrayList<>());
                boolean exists = termItems.stream().anyMatch(item -> item.getCourseId().equals(nc.getCourse().getId()));
                if (!exists) {
                    termItems.add(mapToRoadmapItemResponse(nc.getCourse(), "CUSTOM"));
                }
            }
        }
        
        List<TermGroup> termGroups = termsMap.entrySet().stream().map(e -> {
            return TermGroup.builder()
                    .termOrder(e.getKey())
                    .courses(e.getValue())
                    .build();
        }).collect(Collectors.toList());
        
        return RoadmapResponse.builder()
                .narrowSpecId(narrowSpec.getId())
                .narrowSpecName(narrowSpec.getName())
                .terms(termGroups)
                .build();
    }

    private RoadmapItemResponse mapToRoadmapItemResponse(Course course, String courseType) {
        List<List<UUID>> prerequisiteGroups = new ArrayList<>();
        if (course.getPrerequisites() != null && !course.getPrerequisites().isEmpty()) {
            Map<Integer, List<UUID>> grouped = new TreeMap<>();
            for (CoursePrerequisite cp : course.getPrerequisites()) {
                grouped.computeIfAbsent(cp.getGroupNo(), k -> new ArrayList<>())
                       .add(cp.getPrerequisiteCourse().getId());
            }
            prerequisiteGroups.addAll(grouped.values());
        }
        
        return RoadmapItemResponse.builder()
                .courseId(course.getId())
                .code(course.getCode())
                .name(course.getName())
                .credits(course.getCredits())
                .courseType(courseType)
                .prerequisiteGroups(prerequisiteGroups)
                .countsTowardGpa(course.getCountsTowardGpa())
                .build();
    }

    private NsExcludedCourseResponse mapToNsExcludedCourseResponse(NsExcludedCourse entity) {
        CourseResponse courseResponse = CourseResponse.builder()
                .id(entity.getCourse().getId())
                .code(entity.getCourse().getCode())
                .name(entity.getCourse().getName())
                .credits(entity.getCourse().getCredits())
                .build();
                
        return NsExcludedCourseResponse.builder()
                .id(entity.getId())
                .course(courseResponse)
                .note(entity.getNote())
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

    private NarrowSpecResponse mapToResponse(NarrowSpecialization entity) {
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
}
