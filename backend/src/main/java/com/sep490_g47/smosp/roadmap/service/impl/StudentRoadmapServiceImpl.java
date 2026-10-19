package com.sep490_g47.smosp.roadmap.service.impl;

import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.entity.CoursePrerequisite;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.service.NarrowSpecService;
import com.sep490_g47.smosp.roadmap.dto.request.CloneRoadmapRequest;
import com.sep490_g47.smosp.roadmap.dto.request.ReorderRoadmapItemsRequest;
import com.sep490_g47.smosp.roadmap.dto.request.RenameRoadmapRequest;
import com.sep490_g47.smosp.roadmap.dto.request.UpdateGradeRequest;
import com.sep490_g47.smosp.roadmap.dto.request.UpdateNoteRequest;
import com.sep490_g47.smosp.roadmap.dto.request.UpdateProgressRequest;
import com.sep490_g47.smosp.roadmap.dto.request.BatchReorderRequest;
import com.sep490_g47.smosp.roadmap.dto.response.*;
import com.sep490_g47.smosp.roadmap.entity.*;
import com.sep490_g47.smosp.roadmap.repository.*;
import com.sep490_g47.smosp.roadmap.service.StudentRoadmapService;
import com.sep490_g47.smosp.student.entity.StudentProfile;
import com.sep490_g47.smosp.student.repository.StudentProfileRepository;
import com.sep490_g47.smosp.transcript.entity.CourseGradeStatus;
import com.sep490_g47.smosp.transcript.entity.StudentCourseGrade;
import com.sep490_g47.smosp.transcript.repository.StudentCourseGradeRepository;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.sep490_g47.smosp.roadmap.dto.request.AddPersonalResourceLinkRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentRoadmapServiceImpl implements StudentRoadmapService {

    private final PersonalRoadmapRepository roadmapRepository;
    private final PersonalRoadmapItemRepository itemRepository;
    private final RoadmapBookmarkRepository bookmarkRepository;
    private final RoadmapNoteRepository noteRepository;
    private final PersonalRoadmapResourceRepository resourceRepository;
    private final Cloudinary cloudinary;

    private final StudentProfileRepository studentProfileRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final NarrowSpecService narrowSpecService;
    private final CourseRepository courseRepository;
    private final StudentCourseGradeRepository gradeRepository;

    // ==================== [KHÔNG ĐỔI] Các trạng thái cần check tiên quyết ====================
    // MỚI: chuyển sang IN_PROGRESS hoặc COMPLETED đều phải qua kiểm tra prerequisite.
    // Chuyển về PLANNED (downgrade) KHÔNG bị chặn.
    private static final Set<String> STATUSES_REQUIRING_PREREQ_CHECK =
            Set.of("IN_PROGRESS", "COMPLETED");

    // Whitelist day du — phong ve o tang service, khong chi dua vao @Pattern cua
    // UpdateProgressRequest. Truoc day khong co allowlist nao o day: gui
    // "in_progress" chu thuong qua duoc @NotBlank, roi STATUSES_REQUIRING_PREREQ_CHECK
    // .contains() so khop chinh xac hoa/thuong nen bo qua het cong kiem tien quyet,
    // luu thang gia tri chu thuong. Updategrade() lai so equalsIgnoreCase nen mon
    // vua "lach" tien quyet van nhap diem duoc binh thuong.
    private static final Set<String> VALID_PROGRESS_STATUSES =
            Set.of("PLANNED", "IN_PROGRESS", "COMPLETED");

    // ==================== Kỳ Block 5 & trần tín chỉ ====================
    // Giữa hai kỳ chính có một kỳ phụ tên "Block 5" dành cho học vượt / học lại, trừ sau kỳ 6.
    // Kỳ này được mã hoá thẳng vào personal_term_no theo quy ước BLOCK5_BASE + N = "Block 5 sau
    // kỳ N", giống cách 99 đang biểu diễn nhóm "chưa gán kỳ", nên không phải đổi schema.
    private static final int UNASSIGNED_TERM = 99;
    private static final int BLOCK5_BASE = 100;
    private static final int NO_BLOCK5_AFTER_TERM = 6;
    private static final int MAX_MAIN_TERM = 20;

    private static final int TERM_CREDIT_LIMIT = 21;      // trần tín chỉ của một kỳ chính
    private static final int TERM_COURSE_LIMIT = 7;       // trần số môn của một kỳ chính
    private static final int BLOCK5_CREDIT_LIMIT = 6;     // trần tín chỉ của một kỳ Block 5
    private static final int BLOCK5_COURSE_LIMIT = 2;     // trần số môn của một kỳ Block 5
    private static final int ADVANCED_CREDIT_LIMIT = 6;   // trần tín chỉ được học vượt trong một kỳ
    private static final int ADVANCED_COURSE_LIMIT = 2;   // trần số môn được học vượt trong một kỳ

    private static boolean isBlock5Term(int term) {
        return term > BLOCK5_BASE;
    }

    /** Vị trí của kỳ trên trục thời gian: Block 5 sau kỳ N nằm giữa kỳ N và N+1. */
    private static double termSortKey(int term) {
        if (term == UNASSIGNED_TERM) {
            return Double.MAX_VALUE;
        }
        return isBlock5Term(term) ? (term - BLOCK5_BASE) + 0.5d : term;
    }

    private static String termLabel(int term) {
        if (term == UNASSIGNED_TERM) {
            return "nhóm chưa gán kỳ";
        }
        return isBlock5Term(term) ? "Block 5 sau kỳ " + (term - BLOCK5_BASE) : "kỳ " + term;
    }

    /** Chặn giá trị kỳ rác từ client: chỉ nhận kỳ chính, nhóm chưa gán kỳ, hoặc Block 5 hợp lệ. */
    private static void assertValidTerm(int term) {
        if (term == UNASSIGNED_TERM) {
            return;
        }
        if (isBlock5Term(term)) {
            int host = term - BLOCK5_BASE;
            if (host < 1 || host > MAX_MAIN_TERM || host == NO_BLOCK5_AFTER_TERM) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Kỳ Block 5 không hợp lệ (không có Block 5 sau kỳ " + NO_BLOCK5_AFTER_TERM + ")");
            }
            return;
        }
        if (term < 1 || term > MAX_MAIN_TERM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kỳ học không hợp lệ: " + term);
        }
    }

    private static int courseCredits(Course course) {
        return course != null && course.getCredits() != null ? course.getCredits() : 0;
    }

    /**
     * Kỳ mà môn đang thực sự nằm trong lộ trình cá nhân. Bản ghi cũ có thể mang
     * personal_term_no = null (xem ghi chú ở PersonalRoadmapItem) — khi đó lùi về kỳ gốc, đúng
     * như cách getRoadmapDetail() hiển thị, để việc đếm tín chỉ và dò tiên quyết không bỏ sót.
     */
    private static Integer effectiveTermOf(PersonalRoadmapItem item) {
        if (item.getPersonalTermNo() != null) {
            return item.getPersonalTermNo();
        }
        return item.getOriginalTermNo();
    }

    private static boolean isInTerm(PersonalRoadmapItem item, int term) {
        return Integer.valueOf(term).equals(effectiveTermOf(item));
    }

    /** Tổng tín chỉ đang nằm trong một kỳ của lộ trình cá nhân, bỏ qua môn đang được dời. */
    private static int creditsInTerm(List<PersonalRoadmapItem> allItems, int term, UUID excludeItemId) {
        return allItems.stream()
                .filter(i -> excludeItemId == null || !i.getId().equals(excludeItemId))
                .filter(i -> isInTerm(i, term))
                .mapToInt(i -> courseCredits(i.getCourse()))
                .sum();
    }

    /** Tổng số môn đang nằm trong một kỳ của lộ trình cá nhân, bỏ qua môn đang được dời. */
    private static int coursesInTerm(List<PersonalRoadmapItem> allItems, int term, UUID excludeItemId) {
        return (int) allItems.stream()
                .filter(i -> excludeItemId == null || !i.getId().equals(excludeItemId))
                .filter(i -> isInTerm(i, term))
                .count();
    }

    private StudentProfile getStudentProfile(UUID userId) {
        return studentProfileRepository.findByUserAccountId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));
    }

    private PersonalRoadmap getOwnedRoadmap(UUID userId, UUID roadmapId) {
        StudentProfile profile = getStudentProfile(userId);
        PersonalRoadmap roadmap = roadmapRepository.findById(roadmapId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Roadmap not found"));
        if (!roadmap.getStudentProfile().getId().equals(profile.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this roadmap");
        }
        return roadmap;
    }

    // ==========================================================================================
    // MỚI — Lấy map courseId -> kỳ CHUẨN (theo Standard Roadmap của Narrow Spec gốc).
    // Dùng để: (1) tính kỳ hiệu lực khi customTerm = null, (2) xác định khi Student dời
    // 1 môn về ĐÚNG kỳ chuẩn của nó thì bỏ override (customTerm = null) thay vì giữ dư thừa.
    // ==========================================================================================
    private Map<UUID, Integer> getStandardCourseTermMap(PersonalRoadmap roadmap) {
        RoadmapResponse standardRoadmap = narrowSpecService.getStandardRoadmap(roadmap.getNarrowSpec().getId());
        Map<UUID, Integer> map = new HashMap<>();
        for (TermGroup tg : standardRoadmap.getTerms()) {
            for (RoadmapItemResponse cr : tg.getCourses()) {
                map.put(cr.getCourseId(), tg.getTermOrder());
            }
        }
        return map;
    }

    @Override
    public List<PersonalRoadmapSummaryResponse> getMyRoadmaps(UUID userId) {
        StudentProfile profile = getStudentProfile(userId);
        List<PersonalRoadmap> roadmaps = roadmapRepository.findByStudentProfileIdOrderByCreatedAtDesc(profile.getId());
        return roadmaps.stream().map(this::mapToSummary).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PersonalRoadmapSummaryResponse cloneRoadmap(UUID userId, CloneRoadmapRequest request) {
        StudentProfile profile = getStudentProfile(userId);

        List<PersonalRoadmap> existing = roadmapRepository.findByStudentProfileIdOrderByCreatedAtDesc(profile.getId());
        if (existing.size() >= 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maximum 5 roadmaps allowed");
        }

        NarrowSpecialization ns = narrowSpecRepository.findById(request.getNarrowSpecId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Narrow specialization not found"));

        RoadmapResponse standardRoadmap = narrowSpecService.getStandardRoadmap(ns.getId());

        String newName = "My Roadmap " + (existing.size() + 1);

        PersonalRoadmap roadmap = PersonalRoadmap.builder()
                .studentProfile(profile)
                .narrowSpec(ns)
                .name(newName)
                .clonedAt(LocalDateTime.now())
                .build();

        roadmap = roadmapRepository.save(roadmap);

        List<PersonalRoadmapItem> items = new ArrayList<>();
        for (TermGroup tg : standardRoadmap.getTerms()) {
            for (RoadmapItemResponse courseRes : tg.getCourses()) {
                Course course = courseRepository.findById(courseRes.getCourseId()).orElse(null);
                if (course != null) {
                    items.add(PersonalRoadmapItem.builder()
                            .personalRoadmap(roadmap)
                            .course(course)
                            .progressStatus("PLANNED")
                            .isRemovedFromStandard(false)
                            .manuallyEdited(false)
                            .originalTermNo(tg.getTermOrder())
                            .personalTermNo(tg.getTermOrder())
                            .isAdvancedRegistration(false)
                            .build());
                }
            }
        }
        itemRepository.saveAll(items);

        return mapToSummary(roadmap);
    }

    @Override
    @Transactional
    public PersonalRoadmapDetailResponse getRoadmapDetail(UUID userId, UUID roadmapId) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);

        List<PersonalRoadmapItem> items = itemRepository.findByPersonalRoadmapIdOrderByPersonalTermNoAsc(roadmap.getId());
        List<RoadmapBookmark> bookmarks = bookmarkRepository.findByPersonalRoadmapId(roadmap.getId());
        List<RoadmapNote> notes = noteRepository.findByPersonalRoadmapId(roadmap.getId());

        RoadmapResponse standardRoadmap = narrowSpecService.getStandardRoadmap(roadmap.getNarrowSpec().getId());

        Map<UUID, Integer> standardCourseTermMap = new HashMap<>();
        Map<UUID, RoadmapItemResponse> standardCourseInfoMap = new HashMap<>();
        for (TermGroup tg : standardRoadmap.getTerms()) {
            for (RoadmapItemResponse cr : tg.getCourses()) {
                standardCourseTermMap.put(cr.getCourseId(), tg.getTermOrder());
                standardCourseInfoMap.put(cr.getCourseId(), cr);
            }
        }

        boolean itemsUpdated = false;
        // So sánh theo vị trí trên trục để kỳ Block 5 nằm đúng giữa hai kỳ chính
        Map<Integer, List<PersonalRoadmapItemDetailResponse>> termMap =
                new TreeMap<>(Comparator.comparingDouble(StudentRoadmapServiceImpl::termSortKey));
        List<PersonalRoadmapItemDetailResponse> unassigned = new ArrayList<>();

        Set<UUID> bookmarkedCourseIds = bookmarks.stream().map(b -> b.getCourse().getId()).collect(Collectors.toSet());
        Map<UUID, String> noteMap = notes.stream().collect(Collectors.toMap(n -> n.getCourse().getId(), RoadmapNote::getNote));

        List<PersonalRoadmapResource> allResources = resourceRepository.findByPersonalRoadmapId(roadmap.getId());
        Map<UUID, List<PersonalRoadmapResourceResponse>> resourceMap = allResources.stream()
                .map(this::mapToResourceResponse)
                .collect(Collectors.groupingBy(PersonalRoadmapResourceResponse::getCourseId));

        for (PersonalRoadmapItem item : items) {
            UUID cId = item.getCourse().getId();
            boolean inStandard = standardCourseTermMap.containsKey(cId);

            if (item.getIsRemovedFromStandard() == inStandard) {
                item.setIsRemovedFromStandard(!inStandard);
                itemsUpdated = true;
            }

            RoadmapItemResponse stdInfo = standardCourseInfoMap.get(cId);

            int origTerm = item.getOriginalTermNo() != null ? item.getOriginalTermNo()
                    : (standardCourseTermMap.containsKey(cId) ? standardCourseTermMap.get(cId) : 1);
            int persTerm = item.getPersonalTermNo() != null ? item.getPersonalTermNo() : origTerm;
            boolean isAdv = Boolean.TRUE.equals(item.getIsAdvancedRegistration());

            PersonalRoadmapItemDetailResponse itemRes = PersonalRoadmapItemDetailResponse.builder()
                    .courseId(cId)
                    .code(item.getCourse().getCode())
                    .name(item.getCourse().getName())
                    .description(item.getCourse().getDescription())
                    .credits(item.getCourse().getCredits())
                    .courseType(stdInfo != null ? stdInfo.getCourseType() : "CUSTOM")
                    .prerequisiteGroups(stdInfo != null ? stdInfo.getPrerequisiteGroups() : new ArrayList<>())
                    .progressStatus(item.getProgressStatus())
                    .isRemovedFromStandard(item.getIsRemovedFromStandard())
                    .manuallyEdited(item.getManuallyEdited())
                    .originalTermNo(origTerm)
                    .personalTermNo(persTerm)
                    .isAdvancedRegistration(isAdv)
                    .bookmarked(bookmarkedCourseIds.contains(cId))
                    .note(noteMap.get(cId))
                    .countsTowardGpa(item.getCourse().getCountsTowardGpa())
                    .grade(item.getGrade())
                    .resources(resourceMap.getOrDefault(cId, new ArrayList<>()))
                    .build();

            // Nhóm 99 = "chưa xếp kỳ": môn đã bị gỡ khỏi chương trình chuẩn mà sinh
            // viên chưa tự xếp kỳ cho nó.
            //
            // Điều kiện cũ dùng personalTermNo != null. Vì cột đó từng khai
            // nullable=false + DEFAULT 1 nên nó không bao giờ null, vế 99 không bao
            // giờ đạt tới và nhóm này chết hẳn — môn bị gỡ nằm lẫn trong kỳ thường.
            //
            // Dùng manuallyEdited mới đúng thứ cần hỏi: cloneRoadmap() đặt false,
            // chỉ thao tác thật của sinh viên (updateItem dòng 299, moveItem dòng
            // 407) mới đặt true. Nhờ vậy nhóm 99 hoạt động cho cả dữ liệu cũ lẫn
            // mới, thay vì chỉ sống nhờ bản ghi legacy mang null.
            int effectiveTerm = inStandard || Boolean.TRUE.equals(item.getManuallyEdited()) ? persTerm : 99;

            if (effectiveTerm != 99) {
                termMap.computeIfAbsent(effectiveTerm, k -> new ArrayList<>()).add(itemRes);
            } else {
                unassigned.add(itemRes);
            }
        }

        if (itemsUpdated) {
            itemRepository.saveAll(items);
        }

        List<PersonalTermGroup> terms = new ArrayList<>();
        for (Map.Entry<Integer, List<PersonalRoadmapItemDetailResponse>> entry : termMap.entrySet()) {
            terms.add(PersonalTermGroup.builder().termOrder(entry.getKey()).courses(entry.getValue()).build());
        }

        if (!unassigned.isEmpty()) {
            terms.add(PersonalTermGroup.builder().termOrder(99).courses(unassigned).build());
        }

        return PersonalRoadmapDetailResponse.builder()
                .id(roadmap.getId())
                .narrowSpecId(roadmap.getNarrowSpec().getId())
                .narrowSpecName(roadmap.getNarrowSpec().getName())
                .name(roadmap.getName())
                .clonedAt(roadmap.getClonedAt())
                .updatedAt(roadmap.getUpdatedAt())
                .terms(terms)
                .build();
    }

    @Override
    @Transactional
    public PersonalRoadmapSummaryResponse renameRoadmap(UUID userId, UUID roadmapId, RenameRoadmapRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        roadmap.setName(request.getName());
        return mapToSummary(roadmapRepository.save(roadmap));
    }

    @Override
    @Transactional
    public void deleteRoadmap(UUID userId, UUID roadmapId) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        List<PersonalRoadmapResource> resources = resourceRepository.findByPersonalRoadmapId(roadmapId);
        for (PersonalRoadmapResource res : resources) {
            if (res.getPublicId() != null && !res.getPublicId().isBlank()) {
                destroyQuietly(res.getPublicId());
            }
        }
        roadmapRepository.delete(roadmap);
    }

    @Override
    @Transactional
    public void syncTranscript(UUID userId, UUID roadmapId) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        List<PersonalRoadmapItem> items = itemRepository.findByPersonalRoadmapId(roadmapId);
        List<StudentCourseGrade> allGrades = gradeRepository
                .findByTranscriptStudentProfileIdOrderByUpdatedAtDesc(roadmap.getStudentProfile().getId());

        boolean updated = false;
        for (PersonalRoadmapItem item : items) {
            if (item.getManuallyEdited()) {
                continue; // Skip manually edited items
            }

            List<StudentCourseGrade> matchingGrades = allGrades.stream()
                    .filter(g -> isCourseGradeMatching(item.getCourse(), g))
                    .collect(Collectors.toList());

            if (!matchingGrades.isEmpty()) {
                // Ưu tiên bản ghi đã PASSED, sau đó giữ thứ tự cập nhật mới nhất
                matchingGrades.sort((g1, g2) -> {
                    if (g1.getStatus() == CourseGradeStatus.PASSED && g2.getStatus() != CourseGradeStatus.PASSED) {
                        return -1;
                    }
                    if (g2.getStatus() == CourseGradeStatus.PASSED && g1.getStatus() != CourseGradeStatus.PASSED) {
                        return 1;
                    }
                    return 0;
                });

                StudentCourseGrade bestGrade = matchingGrades.get(0);
                String newStatus = "PLANNED";
                if (bestGrade.getStatus() == CourseGradeStatus.PASSED) {
                    newStatus = "COMPLETED";
                } else if (bestGrade.getStatus() == CourseGradeStatus.FAILED || bestGrade.getStatus() == CourseGradeStatus.STUDYING) {
                    newStatus = "IN_PROGRESS";
                }

                if (!newStatus.equals(item.getProgressStatus())) {
                    item.setProgressStatus(newStatus);
                    updated = true;
                }

                if (bestGrade.getGrade() != null && (item.getGrade() == null || !bestGrade.getGrade().equals(item.getGrade()))) {
                    item.setGrade(bestGrade.getGrade());
                    updated = true;
                }
            }
        }

        if (updated) {
            itemRepository.saveAll(items);
        }
    }

    @Override
    @Transactional
    public void updateProgress(UUID userId, UUID roadmapId, UUID courseId, UpdateProgressRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        PersonalRoadmapItem item = itemRepository.findByPersonalRoadmapIdAndCourseId(roadmapId, courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found in this roadmap"));

        String targetStatus = request.getStatus();

        if (!VALID_PROGRESS_STATUSES.contains(targetStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "status phải là PLANNED, IN_PROGRESS hoặc COMPLETED");
        }

        if (STATUSES_REQUIRING_PREREQ_CHECK.contains(targetStatus)) {
            assertPrerequisitesSatisfied(roadmap, item.getCourse());
        }

        item.setProgressStatus(targetStatus);
        item.setManuallyEdited(true); // Mark as manually edited
        itemRepository.save(item);
    }

    @Override
    @Transactional
    public void updateGrade(UUID userId, UUID roadmapId, UUID courseId, UpdateGradeRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        PersonalRoadmapItem item = itemRepository.findByPersonalRoadmapIdAndCourseId(roadmapId, courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found in this roadmap"));

        if (!"COMPLETED".equalsIgnoreCase(item.getProgressStatus()) && !"done".equalsIgnoreCase(item.getProgressStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ được phép nhập hoặc cập nhật điểm cho môn học có trạng thái Đã học xong");
        }

        java.math.BigDecimal grade = request.getGrade();
        if (grade != null && (grade.compareTo(java.math.BigDecimal.ZERO) < 0 || grade.compareTo(java.math.BigDecimal.TEN) > 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Điểm môn học phải từ 0 đến 10");
        }

        item.setGrade(grade);
        item.setManuallyEdited(true);
        itemRepository.save(item);
    }

    // ==========================================================================================
    // Cập nhật kỳ học của môn trong Personal Roadmap (Rule 1: Học vượt & Rule 2: Đổi kỳ hiển thị)
    // ==========================================================================================
    @Override
    @Transactional
    public void reorderTermItems(UUID userId, UUID roadmapId, ReorderRoadmapItemsRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);

        if (request.getCourseId() == null || request.getTargetTerm() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yêu cầu chuyển kỳ không hợp lệ");
        }
        assertValidTerm(request.getTargetTerm());

        PersonalRoadmapItem movedItem = itemRepository.findByPersonalRoadmapIdAndCourseId(roadmapId, request.getCourseId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Môn học không tồn tại trong lộ trình này"));

        if (Boolean.TRUE.equals(movedItem.getIsRemovedFromStandard())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể chuyển kỳ môn học đã bị gỡ khỏi chương trình chuẩn");
        }

        int origTerm = movedItem.getOriginalTermNo() != null ? movedItem.getOriginalTermNo() : 1;
        int targetTerm = request.getTargetTerm();

        StudentProfile profile = roadmap.getStudentProfile();
        Integer currentTerm = profile.getCurrentTerm();

        List<PersonalRoadmapItem> allItems = itemRepository.findByPersonalRoadmapId(roadmapId);

        // Áp cho MỌI thao tác dời kỳ (học vượt, đổi kỳ hiển thị, học chậm): môn không được rơi
        // vào cùng kỳ với môn tiên quyết chưa hoàn thành của nó.
        List<String> blockingPrereqs =
                findPrerequisitesInTerm(roadmap, movedItem.getCourse(), targetTerm, allItems);
        if (!blockingPrereqs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể chuyển môn '" + movedItem.getCourse().getCode() + "' sang kỳ " + targetTerm
                            + ": môn tiên quyết " + String.join(", ", blockingPrereqs)
                            + " đang ở kỳ " + targetTerm + " và chưa hoàn thành");
        }

        // Chiều ngược lại của cùng ràng buộc: kỳ đích có môn coi môn đang dời là tiên quyết
        List<String> blockingDependents = findDependentsInTerm(roadmap, movedItem, targetTerm, allItems);
        if (!blockingDependents.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể chuyển môn '" + movedItem.getCourse().getCode() + "' sang kỳ " + targetTerm
                            + ": môn " + String.join(", ", blockingDependents) + " ở kỳ " + targetTerm
                            + " có '" + movedItem.getCourse().getCode() + "' là môn tiên quyết, không được học cùng kỳ");
        }

        double origKey = termSortKey(origTerm);
        double targetKey = termSortKey(targetTerm);

        // Trần tín chỉ và số môn của kỳ đích.
        // Nhóm "chưa gán kỳ" là chỗ chứa tạm nên không áp trần.
        if (targetTerm != UNASSIGNED_TERM) {
            int creditLimit = isBlock5Term(targetTerm) ? BLOCK5_CREDIT_LIMIT : TERM_CREDIT_LIMIT;
            int courseLimit = isBlock5Term(targetTerm) ? BLOCK5_COURSE_LIMIT : TERM_COURSE_LIMIT;
            
            int creditsInTerm = creditsInTerm(allItems, targetTerm, movedItem.getId());
            int coursesInTerm = coursesInTerm(allItems, targetTerm, movedItem.getId());
            
            int movingCredits = courseCredits(movedItem.getCourse());
            
            if (creditsInTerm + movingCredits > creditLimit) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Không thể chuyển môn '" + movedItem.getCourse().getCode() + "' sang " + termLabel(targetTerm)
                                + ": " + termLabel(targetTerm) + " đang có " + creditsInTerm + " tín chỉ, thêm môn này ("
                                + movingCredits + " tín chỉ) sẽ vượt trần " + creditLimit + " tín chỉ");
            }
            if (coursesInTerm + 1 > courseLimit) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Không thể chuyển môn '" + movedItem.getCourse().getCode() + "' sang " + termLabel(targetTerm)
                                + ": " + termLabel(targetTerm) + " đang có " + coursesInTerm + " môn, thêm môn này "
                                + "sẽ vượt trần " + courseLimit + " môn");
            }
        }

        if (!isBlock5Term(targetTerm) && (targetTerm == 0 || targetTerm == 5 || targetTerm == 6 || targetTerm == 9)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không được phép dời môn học vào kỳ 0, 5, 6, hoặc 9");
        }

        if (targetKey > origKey) {
            movedItem.setPersonalTermNo(targetTerm);
        } else if (targetKey < origKey) {
            if (origKey - targetKey > 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Không được phép dời lùi môn học quá 1 kỳ so với kỳ gốc (kỳ " + origTerm + ") trong chương trình đào tạo");
            }
            movedItem.setPersonalTermNo(targetTerm);
        } else {
            // --- ĐƯA VỀ KỲ GỐC CHUẨN ---
            movedItem.setPersonalTermNo(origTerm);
        }

        movedItem.setManuallyEdited(true);
        itemRepository.save(movedItem);
    }

    @Override
    @Transactional
    public void batchReorderTermItems(UUID userId, UUID roadmapId, BatchReorderRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        if (request.getMoves() == null || request.getMoves().isEmpty()) return;

        List<PersonalRoadmapItem> allItems = itemRepository.findByPersonalRoadmapId(roadmapId);
        Map<UUID, PersonalRoadmapItem> itemMap = allItems.stream()
                .collect(Collectors.toMap(i -> i.getCourse().getId(), i -> i));

        StudentProfile profile = roadmap.getStudentProfile();
        Integer currentTerm = profile.getCurrentTerm();

        // Bước 1: Áp dụng in-memory TẤT CẢ các thay đổi trước
        for (BatchReorderRequest.ItemMove move : request.getMoves()) {
            assertValidTerm(move.getTargetTerm());
            PersonalRoadmapItem movedItem = itemMap.get(move.getCourseId());
            if (movedItem == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Môn học không tồn tại trong lộ trình này");
            }
            if (Boolean.TRUE.equals(movedItem.getIsRemovedFromStandard())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể chuyển kỳ môn học đã bị gỡ khỏi chương trình chuẩn");
            }

            int origTerm = movedItem.getOriginalTermNo() != null ? movedItem.getOriginalTermNo() : 1;
            int targetTerm = move.getTargetTerm();

            double origKey = termSortKey(origTerm);
            double targetKey = termSortKey(targetTerm);

            if (!isBlock5Term(targetTerm) && (targetTerm == 0 || targetTerm == 5 || targetTerm == 6 || targetTerm == 9)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không được phép dời môn học vào kỳ 0, 5, 6, hoặc 9");
            }

            if (targetKey > origKey) {
                movedItem.setPersonalTermNo(targetTerm);
            } else if (targetKey < origKey) {
                if (origKey - targetKey > 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không được phép dời lùi môn học quá 1 kỳ so với kỳ gốc (kỳ " + origTerm + ")");
                }
                movedItem.setPersonalTermNo(targetTerm);
            } else {
                movedItem.setPersonalTermNo(origTerm);
            }
            movedItem.setManuallyEdited(true);
        }

        // Bước 2: Validate tổng thể
        Set<Integer> termsToCheck = allItems.stream()
                .map(StudentRoadmapServiceImpl::effectiveTermOf)
                .filter(t -> t != null && t != UNASSIGNED_TERM)
                .collect(Collectors.toSet());

        for (Integer targetTerm : termsToCheck) {
            int creditLimit = isBlock5Term(targetTerm) ? BLOCK5_CREDIT_LIMIT : TERM_CREDIT_LIMIT;
            int courseLimit = isBlock5Term(targetTerm) ? BLOCK5_COURSE_LIMIT : TERM_COURSE_LIMIT;

            int creditsInTerm = creditsInTerm(allItems, targetTerm, null);
            int coursesInTerm = coursesInTerm(allItems, targetTerm, null);
            if (creditsInTerm > creditLimit) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, termLabel(targetTerm) + " vượt trần tín chỉ (" + creditsInTerm + "/" + creditLimit + ")");
            }
            if (coursesInTerm > courseLimit) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, termLabel(targetTerm) + " vượt trần số môn (" + coursesInTerm + "/" + courseLimit + ")");
            }

            int advancedCredits = allItems.stream()
                    .filter(i -> isInTerm(i, targetTerm) && Boolean.TRUE.equals(i.getIsAdvancedRegistration()))
                    .mapToInt(i -> courseCredits(i.getCourse()))
                    .sum();
            long advancedCourses = allItems.stream()
                    .filter(i -> isInTerm(i, targetTerm) && Boolean.TRUE.equals(i.getIsAdvancedRegistration()))
                    .count();

            if (advancedCredits > ADVANCED_CREDIT_LIMIT) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kỳ " + targetTerm + " vượt trần tín chỉ học vượt (" + advancedCredits + "/" + ADVANCED_CREDIT_LIMIT + ")");
            }
            if (advancedCourses > ADVANCED_COURSE_LIMIT) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kỳ " + targetTerm + " vượt trần số môn học vượt (" + advancedCourses + "/" + ADVANCED_COURSE_LIMIT + ")");
            }
        }

        // Kiểm tra tiên quyết cho toàn bộ các môn ĐÃ dời
        for (BatchReorderRequest.ItemMove move : request.getMoves()) {
            PersonalRoadmapItem movedItem = itemMap.get(move.getCourseId());
            int targetTerm = effectiveTermOf(movedItem);

            List<String> blockingPrereqs = findPrerequisitesInTerm(roadmap, movedItem.getCourse(), targetTerm, allItems);
            if (!blockingPrereqs.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Môn '" + movedItem.getCourse().getCode() + "' ở kỳ " + targetTerm + " vướng môn tiên quyết: " + String.join(", ", blockingPrereqs));
            }

            List<String> blockingDependents = findDependentsInTerm(roadmap, movedItem, targetTerm, allItems);
            if (!blockingDependents.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Môn '" + movedItem.getCourse().getCode() + "' ở kỳ " + targetTerm + " bị vướng môn phụ thuộc: " + String.join(", ", blockingDependents));
            }
        }

        // Bước 3: Lưu xuống DB
        itemRepository.saveAll(itemMap.values());
    }

    @Override
    @Transactional
    public void addBookmark(UUID userId, UUID roadmapId, UUID courseId) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        if (bookmarkRepository.findByPersonalRoadmapIdAndCourseId(roadmapId, courseId).isEmpty()) {
            Course course = courseRepository.findById(courseId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
            bookmarkRepository.save(RoadmapBookmark.builder().personalRoadmap(roadmap).course(course).build());
        }
    }

    @Override
    @Transactional
    public void removeBookmark(UUID userId, UUID roadmapId, UUID courseId) {
        getOwnedRoadmap(userId, roadmapId);
        bookmarkRepository.deleteByPersonalRoadmapIdAndCourseId(roadmapId, courseId);
    }

    @Override
    @Transactional
    public void updateNote(UUID userId, UUID roadmapId, UUID courseId, UpdateNoteRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        RoadmapNote note = noteRepository.findByPersonalRoadmapIdAndCourseId(roadmapId, courseId).orElse(null);
        if (note == null) {
            Course course = courseRepository.findById(courseId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
            note = RoadmapNote.builder().personalRoadmap(roadmap).course(course).build();
        }
        note.setNote(request.getNote());
        noteRepository.save(note);
    }

    @Override
    @Transactional
    public void removeNote(UUID userId, UUID roadmapId, UUID courseId) {
        getOwnedRoadmap(userId, roadmapId);
        noteRepository.deleteByPersonalRoadmapIdAndCourseId(roadmapId, courseId);
    }

    private PersonalRoadmapSummaryResponse mapToSummary(PersonalRoadmap r) {
        return PersonalRoadmapSummaryResponse.builder()
                .id(r.getId())
                .narrowSpecId(r.getNarrowSpec().getId())
                .narrowSpecName(r.getNarrowSpec().getName())
                .name(r.getName())
                .clonedAt(r.getClonedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }

    // ==========================================================================================
    // MỚI — Prerequisite gate cho updateProgress()
    // Rule: 1 course có thể có nhiều prerequisite group (groupNo).
    //   - Trong 1 group: OR (chỉ cần hoàn thành 1 môn trong group)
    //   - Giữa các group: AND (phải hoàn thành tất cả các group)
    // Áp dụng khi chuyển sang IN_PROGRESS hoặc COMPLETED. Chuyển về PLANNED
    // (downgrade) không bị chặn.
    // ==========================================================================================

    private void assertPrerequisitesSatisfied(PersonalRoadmap roadmap, Course course) {
        List<String> missingGroups = findMissingPrerequisiteGroups(roadmap, course);
        if (!missingGroups.isEmpty()) {
            String missing = String.join(" VÀ ", missingGroups);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot update status: prerequisite course(s) not completed yet (" + missing + ")");
        }
    }

    /**
     * Các nhóm tiên quyết CHƯA thoả của một môn, đã format sẵn để ghép vào thông báo lỗi.
     * Rỗng nghĩa là đủ điều kiện. Dùng cho gate của updateProgress().
     */
    private List<String> findMissingPrerequisiteGroups(PersonalRoadmap roadmap, Course course) {
        Map<Integer, List<Course>> groups = groupPrerequisites(course);
        if (groups.isEmpty()) {
            return List.of(); // không có tiên quyết -> luôn cho phép
        }

        // Trạng thái các môn trong CHÍNH roadmap này (nguồn ưu tiên, được
        // đồng bộ bởi syncTranscript khi chưa manuallyEdited)
        Map<UUID, String> statusInRoadmap = itemRepository.findByPersonalRoadmapId(roadmap.getId()).stream()
                .collect(Collectors.toMap(i -> i.getCourse().getId(), PersonalRoadmapItem::getProgressStatus));

        List<String> missingGroups = new ArrayList<>();
        for (List<Course> group : groups.values()) {
            boolean groupSatisfied = group.stream()
                    .anyMatch(prereq -> isCourseCompleted(roadmap, prereq, statusInRoadmap));
            if (!groupSatisfied) {
                String groupDesc = group.stream()
                        .map(Course::getCode)
                        .collect(Collectors.joining(" HOẶC "));
                missingGroups.add(group.size() > 1 ? "(" + groupDesc + ")" : groupDesc);
            }
        }
        return missingGroups;
    }

    /** Tiên quyết của 1 môn gom theo groupNo: trong 1 group là OR, giữa các group là AND. */
    private Map<Integer, List<Course>> groupPrerequisites(Course course) {
        List<CoursePrerequisite> prerequisites = course.getPrerequisites();
        if (prerequisites == null || prerequisites.isEmpty()) {
            return Map.of();
        }
        return prerequisites.stream()
                .collect(Collectors.groupingBy(
                        CoursePrerequisite::getGroupNo,
                        Collectors.mapping(CoursePrerequisite::getPrerequisiteCourse, Collectors.toList())
                ));
    }

    /**
     * Dời môn X về kỳ targetTerm: xét TỪNG môn tiên quyết một, không gom nhóm OR/AND.
     * Mỗi tiên quyết phải hoặc đã hoàn thành, hoặc không nằm trong chính targetTerm của lộ
     * trình CÁ NHÂN — tức không học đồng thời với X. Vì xét theo personalTermNo nên tiên quyết
     * đã được học vượt lên kỳ sớm hơn tự động hợp lệ.
     *
     * @return mã các môn tiên quyết đang chặn (rỗng = hợp lệ)
     */
    private List<String> findPrerequisitesInTerm(PersonalRoadmap roadmap, Course course,
                                                 int targetTerm, List<PersonalRoadmapItem> allItems) {
        List<CoursePrerequisite> prerequisites = course.getPrerequisites();
        if (prerequisites == null || prerequisites.isEmpty()) {
            return List.of();
        }

        Map<UUID, String> statusInRoadmap = allItems.stream()
                .collect(Collectors.toMap(i -> i.getCourse().getId(), PersonalRoadmapItem::getProgressStatus));
        Map<UUID, Integer> termInRoadmap = allItems.stream()
                .filter(i -> effectiveTermOf(i) != null)
                .collect(Collectors.toMap(i -> i.getCourse().getId(), StudentRoadmapServiceImpl::effectiveTermOf));

        return prerequisites.stream()
                .map(CoursePrerequisite::getPrerequisiteCourse)
                .filter(prereq -> {
                    Integer prereqTerm = termInRoadmap.get(prereq.getId());
                    if (prereqTerm == null || prereqTerm != targetTerm) {
                        return false; // không nằm trong kỳ đích -> không chặn
                    }
                    return !isCourseCompleted(roadmap, prereq, statusInRoadmap);
                })
                .map(Course::getCode)
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * Chiều ngược lại của {@link #findPrerequisitesInTerm}: dời môn X chưa hoàn thành vào kỳ
     * targetTerm mà ở đó có môn Y coi X là tiên quyết thì cũng thành học cùng kỳ -> chặn.
     *
     * @return mã các môn ở kỳ đích đang phụ thuộc vào môn được dời (rỗng = hợp lệ)
     */
    private List<String> findDependentsInTerm(PersonalRoadmap roadmap, PersonalRoadmapItem movedItem,
                                              int targetTerm, List<PersonalRoadmapItem> allItems) {
        Map<UUID, String> statusInRoadmap = allItems.stream()
                .collect(Collectors.toMap(i -> i.getCourse().getId(), PersonalRoadmapItem::getProgressStatus));
        if (isCourseCompleted(roadmap, movedItem.getCourse(), statusInRoadmap)) {
            return List.of(); // đã học xong thì không cản môn nào cả
        }

        UUID movedCourseId = movedItem.getCourse().getId();
        return allItems.stream()
                .filter(i -> !i.getId().equals(movedItem.getId()))
                .filter(i -> isInTerm(i, targetTerm))
                .filter(i -> {
                    List<CoursePrerequisite> prereqs = i.getCourse().getPrerequisites();
                    return prereqs != null && prereqs.stream()
                            .anyMatch(p -> p.getPrerequisiteCourse() != null
                                    && movedCourseId.equals(p.getPrerequisiteCourse().getId()));
                })
                .map(i -> i.getCourse().getCode())
                .distinct()
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PersonalRoadmapResourceResponse uploadPersonalResourceFile(UUID userId, UUID roadmapId, UUID courseId, String title, String resourceType, MultipartFile file) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Môn học không tồn tại"));

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn tệp để tải lên");
        }

        // Kiểm tra dung lượng tệp: tối đa 25MB
        long maxSizeBytes = 25L * 1024 * 1024;
        if (file.getSize() > maxSizeBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kích thước tệp không được vượt quá 25MB");
        }

        // Ràng buộc giới hạn: mỗi đứa max 3 file cho 1 môn học trong lộ trình
        long existingFileCount = resourceRepository.countByPersonalRoadmapIdAndCourseIdAndPublicIdIsNotNull(roadmapId, courseId);
        if (existingFileCount >= 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mỗi môn học trong lộ trình cá nhân chỉ được phép tải lên tối đa 3 tệp tài nguyên");
        }

        String finalTitle = (title != null && !title.isBlank()) ? title.trim() : file.getOriginalFilename();
        String type = (resourceType != null && !resourceType.isBlank()) ? resourceType.trim() : "FILE";

        try {
            String uniqueFileName = UUID.randomUUID().toString().substring(0, 8) + "_" + (file.getOriginalFilename() != null ? file.getOriginalFilename() : "resource");
            Map params = ObjectUtils.asMap(
                    "resource_type", "auto",
                    "folder", "personal_roadmap_resources",
                    "public_id", uniqueFileName
            );
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), params);
            String url = uploadResult.get("secure_url").toString();
            String publicId = String.valueOf(uploadResult.get("public_id"));

            PersonalRoadmapResource res = PersonalRoadmapResource.builder()
                    .personalRoadmap(roadmap)
                    .course(course)
                    .title(finalTitle)
                    .url(url)
                    .publicId(publicId)
                    .resourceType(type)
                    .fileSize(file.getSize())
                    .fileName(file.getOriginalFilename())
                    .build();

            res = resourceRepository.save(res);
            return mapToResourceResponse(res);
        } catch (Exception e) {
            log.error("Lỗi khi tải tệp tài nguyên lên Cloudinary: ", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Tải tệp lên Cloudinary thất bại", e);
        }
    }

    @Override
    @Transactional
    public PersonalRoadmapResourceResponse addPersonalResourceLink(UUID userId, UUID roadmapId, UUID courseId, AddPersonalResourceLinkRequest request) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Môn học không tồn tại"));

        String url = request.getUrl().trim();
        if (!url.matches("^(https?|ftp)://[^\\s/$.?#].[^\\s]*$")) {
            url = "https://" + url;
        }

        String type = (request.getResourceType() != null && !request.getResourceType().isBlank()) ? request.getResourceType().trim() : "LINK";

        PersonalRoadmapResource res = PersonalRoadmapResource.builder()
                .personalRoadmap(roadmap)
                .course(course)
                .title(request.getTitle().trim())
                .url(url)
                .publicId(null)
                .resourceType(type)
                .fileSize(null)
                .fileName(null)
                .build();

        res = resourceRepository.save(res);
        return mapToResourceResponse(res);
    }

    @Override
    @Transactional
    public void deletePersonalResource(UUID userId, UUID roadmapId, UUID resourceId) {
        PersonalRoadmap roadmap = getOwnedRoadmap(userId, roadmapId);
        PersonalRoadmapResource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tài nguyên không tồn tại"));

        if (!resource.getPersonalRoadmap().getId().equals(roadmap.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xóa tài nguyên này");
        }

        if (resource.getPublicId() != null) {
            destroyQuietly(resource.getPublicId());
        }

        resourceRepository.delete(resource);
    }

    private void destroyQuietly(String publicId) {
        if (publicId == null) return;
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "auto"));
        } catch (Exception e) {
            log.error("Không xóa được tệp trên Cloudinary (public_id={})", publicId, e);
        }
    }

    private PersonalRoadmapResourceResponse mapToResourceResponse(PersonalRoadmapResource r) {
        return PersonalRoadmapResourceResponse.builder()
                .id(r.getId())
                .courseId(r.getCourse().getId())
                .title(r.getTitle())
                .url(r.getUrl())
                .publicId(r.getPublicId())
                .resourceType(r.getResourceType())
                .fileSize(r.getFileSize())
                .fileName(r.getFileName())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private boolean isCourseCompleted(PersonalRoadmap roadmap, Course prereq, Map<UUID, String> statusInRoadmap) {
        String status = statusInRoadmap.get(prereq.getId());
        if (status != null) {
            return "COMPLETED".equals(status);
        }
        // Fallback: môn tiên quyết không nằm trong Personal Roadmap này -> tra thẳng transcript
        List<StudentCourseGrade> allGrades = gradeRepository
                .findByTranscriptStudentProfileIdOrderByUpdatedAtDesc(roadmap.getStudentProfile().getId());
        return allGrades.stream()
                .filter(g -> isCourseGradeMatching(prereq, g))
                .anyMatch(g -> g.getStatus() == CourseGradeStatus.PASSED);
    }

    private boolean isCourseGradeMatching(Course course, StudentCourseGrade grade) {
        if (course == null || grade == null) {
            return false;
        }

        // 1. Đối chiếu qua Course ID
        if (grade.getCourse() != null && grade.getCourse().getId().equals(course.getId())) {
            return true;
        }

        String courseCode = course.getCode() != null ? course.getCode().trim() : "";
        String gradeRawCode = grade.getCourseCodeRaw() != null ? grade.getCourseCodeRaw().trim() : "";
        String gradeCourseCode = (grade.getCourse() != null && grade.getCourse().getCode() != null)
                ? grade.getCourse().getCode().trim() : "";

        if (courseCode.isEmpty()) {
            return false;
        }

        // 2. Đối chiếu khớp mã trực tiếp (không phân biệt hoa thường)
        if (courseCode.equalsIgnoreCase(gradeRawCode) || courseCode.equalsIgnoreCase(gradeCourseCode)) {
            return true;
        }

        // 3. Quy tắc đối chiếu mã thay thế / placeholder đặc biệt
        return isSpecialPlaceholderMatch(courseCode, gradeRawCode)
                || isSpecialPlaceholderMatch(courseCode, gradeCourseCode)
                || isSpecialPlaceholderMatch(gradeRawCode, courseCode)
                || isSpecialPlaceholderMatch(gradeCourseCode, courseCode);
    }

    private boolean isSpecialPlaceholderMatch(String codeA, String codeB) {
        if (codeA == null || codeB == null || codeA.isEmpty() || codeB.isEmpty()) {
            return false;
        }
        String normA = codeA.toUpperCase();
        String normB = codeB.toUpperCase();
        String normAStripped = normA.replaceAll("[*_\\s]", "");

        // PHE_COM*1 -> VOV114 hoặc COV111
        if (normA.equals("PHE_COM*1") || normAStripped.equals("PHECOM1")) {
            return normB.equals("VOV114") || normB.equals("COV111");
        }

        // PHE_COM*2 -> VOV124 hoặc COV121
        if (normA.equals("PHE_COM*2") || normAStripped.equals("PHECOM2")) {
            return normB.equals("VOV124") || normB.equals("COV121");
        }

        // PHE_COM*3 -> VOV134 hoặc COV131
        if (normA.equals("PHE_COM*3") || normAStripped.equals("PHECOM3")) {
            return normB.equals("VOV134") || normB.equals("COV131");
        }

        // TMI_ELE -> Các môn chứa TMI (vd: TMI101)
        if (normA.equals("TMI_ELE") || normAStripped.startsWith("TMIELE")) {
            return normB.contains("TMI");
        }

        // OTP101 -> Các môn GDQP (Giáo dục quốc phòng)
        if (normA.equals("OTP101") || normAStripped.equals("OTP101") || normA.startsWith("OTP")) {
            return normB.contains("GDQP") || normB.contains("OTP");
        }

        return false;
    }
}