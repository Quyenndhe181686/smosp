package com.sep490_g47.smosp.course.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.sep490_g47.smosp.course.dto.response.CourseDetailResponse;
import com.sep490_g47.smosp.course.dto.request.CourseRequest;
import com.sep490_g47.smosp.course.dto.response.CourseOptionResponse;
import com.sep490_g47.smosp.course.dto.response.CourseResponse;
import com.sep490_g47.smosp.course.dto.response.LearningResourceResponse;
import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.entity.CoursePrerequisite;
import com.sep490_g47.smosp.course.entity.LearningResource;
import com.sep490_g47.smosp.course.enums.ResourceType;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.course.repository.LearningResourceRepository;
import com.sep490_g47.smosp.course.util.CourseConstants;
import com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CourseServiceImpl implements CourseService, LearningResourceService {

    private final CourseRepository courseRepository;
    private final LearningResourceRepository learningResourceRepository;
    private final LearningResourcePersistence learningResourcePersistence;
    private final NsCourseRepository nsCourseRepository;
    private final com.sep490_g47.smosp.specialization.repository.SpecCourseRepository specCourseRepository;
    private final Cloudinary cloudinary;

    @Override
    @Transactional(readOnly = true)
    public Page<CourseResponse> getCourses(String code, String name, Boolean isActive, Boolean countsTowardGpa, Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            List<Sort.Order> validOrders = pageable.getSort().stream()
                    .filter(order -> order.getProperty() != null && !order.getProperty().trim().isEmpty())
                    .collect(Collectors.toList());
            if (validOrders.isEmpty()) {
                pageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.unsorted());
            } else {
                pageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(validOrders));
            }
        }

        return courseRepository.findCoursesWithFilters(code, name, isActive, countsTowardGpa, pageable)
                .map(this::mapToResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CourseOptionResponse> searchCourseOptions(String keyword, int limit) {
        // Từ khoá rỗng trả danh sách rỗng thay vì đổ cả nghìn môn về client: ô tìm
        // kiếm chỉ hiển thị kết quả sau khi người dùng gõ, không có trạng thái
        // "xem tất cả".
        if (keyword == null || keyword.trim().isEmpty()) {
            return List.of();
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        return courseRepository
                .searchActiveCourseOptions(keyword.trim(), PageRequest.of(0, safeLimit))
                .stream()
                .map(row -> new CourseOptionResponse((UUID) row[0], (String) row[1], (String) row[2]))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CourseDetailResponse getCourseDetail(UUID id) {
        Course course = courseRepository.findDetailById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND));

        if (!isContentManagerOrAdmin()) {
            var nsCourses = nsCourseRepository.findByCourseId(id);
            var specCourses = specCourseRepository.findByCourseId(id);

            boolean hasPublishedNs = nsCourses.stream()
                    .anyMatch(nsc -> Boolean.TRUE.equals(nsc.getNarrowSpec().getIsPublished()));
                    
            boolean hasActiveSpec = specCourses.stream()
                    .anyMatch(sc -> {
                        com.sep490_g47.smosp.specialization.entity.Specialization spec = sc.getSpecialization();
                        return spec != null && Boolean.TRUE.equals(spec.getIsActive()) &&
                               spec.getMajor() != null && Boolean.TRUE.equals(spec.getMajor().getIsActive());
                    });

            if (!nsCourses.isEmpty() || !specCourses.isEmpty()) {
                if (!hasPublishedNs && !hasActiveSpec) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND);
                }
            }
        }

        return mapToDetailResponse(course);
    }

    @Override
    @Transactional
    public CourseResponse createCourse(CourseRequest request) {
        if (courseRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CourseConstants.ERR_CODE_UNIQUE);
        }

        Course course = Course.builder()
                .code(request.getCode())
                .name(request.getName())
                .credits(request.getCredits())
                .description(request.getDescription())
                .countsTowardGpa(request.getCountsTowardGpa() != null ? request.getCountsTowardGpa() : true)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        course = courseRepository.save(course);
        return mapToResponse(course);
    }

    @Override
    @Transactional
    public CourseResponse updateCourse(UUID id, CourseRequest request) {
        Course course = courseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND));

        if (courseRepository.existsByCodeAndIdNot(request.getCode(), id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CourseConstants.ERR_CODE_UNIQUE);
        }

        course.setCode(request.getCode());
        course.setName(request.getName());
        course.setCredits(request.getCredits());
        course.setDescription(request.getDescription());

        if (request.getCountsTowardGpa() != null) {
            course.setCountsTowardGpa(request.getCountsTowardGpa());
        }
        // Chỉ kiểm 8-tham-chiếu khi thực sự đang CHUYỂN active -> inactive. Trước
        // đây updateCourse() gán thẳng isActive không qua bất kỳ kiểm nào, trong
        // khi deleteCourse() (bên dưới) kiểm đủ 8 nơi cho đúng hiệu ứng đó — cả hai
        // method cuối cùng chỉ làm MỘT việc như nhau (setIsActive(false)), nên
        // guard của deleteCourse() bị PUT /courses/{id} đi vòng qua hoàn toàn.
        if (request.getIsActive() != null) {
            boolean deactivating = Boolean.FALSE.equals(request.getIsActive())
                    && Boolean.TRUE.equals(course.getIsActive());
            if (deactivating) {
                assertCourseNotInUse(id);
            }
            course.setIsActive(request.getIsActive());
        }

        course = courseRepository.save(course);
        return mapToResponse(course);
    }

    @Override
    @Transactional
    public void deleteCourse(UUID id) {
        Course course = courseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND));

        assertCourseNotInUse(id);

        course.setIsActive(false);
        courseRepository.save(course);
    }

    /** Dùng chung cho cả deleteCourse() và nhánh vô hiệu hoá của updateCourse(). */
    private void assertCourseNotInUse(UUID id) {
        long usageInNs = courseRepository.countUsagesInNarrowSpec(id);
        long usageAsPre = courseRepository.countUsagesAsPrerequisite(id);
        long usageInSpec = courseRepository.countUsagesInSpecCourse(id);
        long usageInPersonalRoadmap = courseRepository.countUsagesInPersonalRoadmap(id);
        long usageInRoadmapBookmark = courseRepository.countUsagesInRoadmapBookmark(id);
        long usageInRoadmapNote = courseRepository.countUsagesInRoadmapNote(id);
        long usageInStudentGrade = courseRepository.countUsagesInStudentGrade(id);
        long usageInSkillMap = courseRepository.countUsagesInSkillMap(id);

        if (usageInNs > 0 || usageAsPre > 0 || usageInSpec > 0 || usageInPersonalRoadmap > 0 ||
            usageInRoadmapBookmark > 0 || usageInRoadmapNote > 0 || usageInStudentGrade > 0 || usageInSkillMap > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, CourseConstants.ERR_COURSE_IN_USE);
        }
    }

    @Override
    @Transactional
    public CourseDetailResponse updatePrerequisites(UUID id, List<List<UUID>> prerequisiteGroups) {
        Course course = courseRepository.findDetailById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND));

        int totalPrereqs = 0;
        if (prerequisiteGroups != null) {
            for (List<UUID> group : prerequisiteGroups) {
                if (group != null) {
                    totalPrereqs += group.size();
                }
            }
        }
        if (totalPrereqs > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Course cannot have more than 5 prerequisites in total");
        }

        if (course.getPrerequisites() == null) {
            course.setPrerequisites(new ArrayList<>());
        } else {
            course.getPrerequisites().clear();
        }

        if (prerequisiteGroups != null) {
            int groupNo = 1;
            for (List<UUID> group : prerequisiteGroups) {
                // Trước đây bỏ qua nhóm rỗng trong im lặng rồi đánh số lại các
                // nhóm sau — cổng tiên quyết cuối cùng lỏng hơn ý định người cấu
                // hình: nếu người cấu hình gửi nhóm rỗng do lỗi UI (xoá hết môn
                // trong nhóm nhưng không xoá nhóm), backend âm thầm nuốt luôn,
                // không có cách nào biết cấu hình đã bị đổi ý nghĩa. Từ chối rõ
                // ràng để người cấu hình tự sửa dữ liệu gửi lên, thay vì đoán hộ.
                if (group == null || group.isEmpty()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Nhóm tiên quyết không được để rỗng — xoá hẳn nhóm nếu không cần, đừng gửi nhóm rỗng");
                }
                for (UUID prereqId : group) {
                    Course prereq = courseRepository.findDetailById(prereqId)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prerequisite " + CourseConstants.ERR_COURSE_NOT_FOUND));
                    
                    // Cycle detection: Can prereq reach course?
                    if (hasPath(prereq, course, new HashSet<>())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CourseConstants.ERR_CIRCULAR_DEPENDENCY);
                    }
                    
                    CoursePrerequisite cp = CoursePrerequisite.builder()
                            .course(course)
                            .prerequisiteCourse(prereq)
                            .groupNo(groupNo)
                            .build();
                    course.getPrerequisites().add(cp);
                }
                groupNo++;
            }
        }

        course = courseRepository.save(course);
        return mapToDetailResponse(course);
    }

    private boolean hasPath(Course start, Course target, Set<UUID> visited) {
        if (start.getId().equals(target.getId())) {
            return true;
        }
        if (visited.contains(start.getId())) {
            return false;
        }
        visited.add(start.getId());

        if (start.getPrerequisites() != null) {
            for (CoursePrerequisite cp : start.getPrerequisites()) {
                if (hasPath(cp.getPrerequisiteCourse(), target, visited)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Kết quả 1 lần upload lên Cloudinary — giữ cả publicId để dọn file rác khi ghi DB fail. */
    private record UploadedFile(String url, String publicId) {}

    /**
     * CỐ Ý không có @Transactional: upload file lên Cloudinary là network I/O, file
     * vài chục MB có thể mất hàng chục giây. Bọc transaction quanh đây đồng nghĩa
     * giữ 1 DB connection suốt cả quá trình upload. Phần ghi DB được đẩy sang
     * {@link LearningResourcePersistence} với transaction ngắn riêng.
     */
    @Override
    public LearningResourceResponse uploadResource(UUID courseId, String title, ResourceType type, MultipartFile file, String linkUrl) {
        if (!courseRepository.existsById(courseId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND);
        }

        String finalUrl = linkUrl;
        String uploadedPublicId = null;

        if (type == ResourceType.DOCS || type == ResourceType.EXERCISE) {
            if (file == null || file.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required for DOCS and EXERCISE");
            }
            validateUploadFileName(file);

            UploadedFile uploaded = uploadRawFile(file);
            finalUrl = uploaded.url();
            uploadedPublicId = uploaded.publicId();
        } else if (type == ResourceType.LINK || type == ResourceType.ARTICLE) {
            if (linkUrl == null || linkUrl.trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "URL is required for LINK and ARTICLE");
            }
            validateUrlFormat(linkUrl);
        }

        try {
            return mapToLearningResourceResponse(
                    learningResourcePersistence.createResource(courseId, title, type, finalUrl));
        } catch (RuntimeException e) {
            // File đã nằm trên Cloudinary với public_id ngẫu nhiên nhưng không có row
            // nào trỏ tới → rác vĩnh viễn nếu không dọn ngay.
            destroyQuietly(uploadedPublicId);
            throw e;
        }
    }

    /** Không @Transactional — xem giải thích ở {@link #uploadResource}. */
    @Override
    public LearningResourceResponse updateResource(UUID resourceId, String title, ResourceType type, MultipartFile file, String linkUrl, Integer displayOrder) {
        LearningResource current = learningResourcePersistence.findRequired(resourceId);
        // Type sau khi cập nhật mới là type quyết định cách xử lý file/link.
        ResourceType effectiveType = type != null ? type : current.getResourceType();

        String newUrl = null;
        String uploadedPublicId = null;

        if (effectiveType == ResourceType.DOCS || effectiveType == ResourceType.EXERCISE) {
            if (file != null && !file.isEmpty()) {
                validateUploadFileName(file);
                UploadedFile uploaded = uploadRawFile(file);
                newUrl = uploaded.url();
                uploadedPublicId = uploaded.publicId();
            } else if (linkUrl != null && !linkUrl.isEmpty()) {
                validateUrlFormat(linkUrl);
                newUrl = linkUrl;
            }
        } else if (effectiveType == ResourceType.LINK || effectiveType == ResourceType.ARTICLE) {
            if (linkUrl != null && !linkUrl.trim().isEmpty()) {
                validateUrlFormat(linkUrl);
                newUrl = linkUrl;
            }
        }

        try {
            return mapToLearningResourceResponse(
                    learningResourcePersistence.updateResource(resourceId, title, type, newUrl, displayOrder));
        } catch (RuntimeException e) {
            destroyQuietly(uploadedPublicId);
            throw e;
        }
    }

    /** Không @Transactional — xem giải thích ở {@link #uploadResource}. */
    @Override
    public void deleteResource(UUID resourceId) {
        LearningResource resource = learningResourcePersistence.findRequired(resourceId);

        String publicId = null;
        if (resource.getResourceType() == ResourceType.DOCS || resource.getResourceType() == ResourceType.EXERCISE) {
            publicId = extractPublicId(resource.getUrl());
        }

        // Xoá row trước, xoá file sau. Thứ tự ngược lại (như code cũ) nguy hiểm hơn:
        // destroy xong mà commit DB fail thì file đã mất trong khi row vẫn còn → link
        // hỏng vĩnh viễn, không khôi phục được. Còn theo thứ tự này, xấu nhất chỉ là
        // file rác trên Cloudinary và đã được log lại để dọn.
        learningResourcePersistence.deleteById(resourceId);
        destroyQuietly(publicId);
    }

    private void validateUploadFileName(MultipartFile file) {
        String fileName = file.getOriginalFilename();
        if (fileName == null || !fileName.matches("(?i).*\\.(zip|rar|pdf|doc|docx|xls|xlsx)$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CourseConstants.ERR_INVALID_FILE_FORMAT);
        }
    }

    private void validateUrlFormat(String linkUrl) {
        if (!linkUrl.matches("^(https?|ftp)://[^\\s/$.?#].[^\\s]*$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid URL format");
        }
    }

    private UploadedFile uploadRawFile(MultipartFile file) {
        try {
            String uniqueFileName = UUID.randomUUID().toString().substring(0, 8) + "_" + file.getOriginalFilename();
            Map params = ObjectUtils.asMap(
                    "resource_type", "raw",
                    "folder", "learning_resources",
                    "public_id", uniqueFileName
            );
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), params);
            // Lấy public_id từ response thay vì tự ghép với folder — Cloudinary mới là
            // nơi quyết định giá trị cuối cùng.
            return new UploadedFile(
                    uploadResult.get("secure_url").toString(),
                    String.valueOf(uploadResult.get("public_id")));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, CourseConstants.ERR_CLOUDINARY_UPLOAD, e);
        }
    }

    private String extractPublicId(String url) {
        if (url == null || !url.contains("/upload/")) {
            return null;
        }
        String[] parts = url.split("/upload/");
        if (parts.length <= 1) {
            return null;
        }
        return parts[1].replaceFirst("^v\\d+/", "");
    }

    private void destroyQuietly(String publicId) {
        if (publicId == null) {
            return;
        }
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", "raw"));
        } catch (Exception e) {
            log.error("Không xoá được file trên Cloudinary (public_id={}), cần dọn thủ công", publicId, e);
        }
    }

    @Override
    @Transactional
    public void updateResourceOrder(UUID courseId, Map<UUID, Integer> orderMap) {
        if (!courseRepository.existsById(courseId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND);
        }

        List<LearningResource> resources = learningResourceRepository.findByCourseId(courseId);
        
        for (LearningResource res : resources) {
            Integer newOrder = orderMap.get(res.getId());
            if (newOrder != null) {
                res.setDisplayOrder(newOrder);
            }
        }
        
        learningResourceRepository.saveAll(resources);
    }

    private CourseResponse mapToResponse(Course course) {
        Set<String> prereqCodes = new HashSet<>();
        if (course.getPrerequisites() != null) {
            try {
                prereqCodes = course.getPrerequisites().stream()
                        .map(p -> p.getPrerequisiteCourse() != null ? p.getPrerequisiteCourse().getCode() : null)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
            } catch (Exception e) {
                // Ignore lazy initialization issues if any
            }
        }
        return CourseResponse.builder()
                .id(course.getId())
                .code(course.getCode())
                .name(course.getName())
                .credits(course.getCredits())
                .description(course.getDescription())
                .countsTowardGpa(course.getCountsTowardGpa())
                .isActive(course.getIsActive())
                .prerequisiteCodes(prereqCodes)
                .resourceCount(course.getLearningResources() != null ? course.getLearningResources().size() : 0)
                .createdAt(course.getCreatedAt())
                .updatedAt(course.getUpdatedAt())
                .build();
    }

    private CourseDetailResponse mapToDetailResponse(Course course) {
        List<List<CourseResponse>> prerequisiteGroups = new ArrayList<>();
        if (course.getPrerequisites() != null && !course.getPrerequisites().isEmpty()) {
            Map<Integer, List<CourseResponse>> grouped = new TreeMap<>();
            for (CoursePrerequisite cp : course.getPrerequisites()) {
                grouped.computeIfAbsent(cp.getGroupNo(), k -> new ArrayList<>())
                       .add(mapToResponse(cp.getPrerequisiteCourse()));
            }
            prerequisiteGroups.addAll(grouped.values());
        }

        List<LearningResourceResponse> resources = new ArrayList<>();
        if (course.getLearningResources() != null) {
            resources = course.getLearningResources().stream()
                    .map(this::mapToLearningResourceResponse)
                    .sorted(Comparator.comparing(LearningResourceResponse::getDisplayOrder).thenComparing(LearningResourceResponse::getCreatedAt))
                    .collect(Collectors.toList());
        }

        Set<UUID> specIds = new HashSet<>();
        List<com.sep490_g47.smosp.specialization.entity.SpecCourse> specCourses = specCourseRepository.findByCourseId(course.getId());
        for (var sc : specCourses) {
            specIds.add(sc.getSpecialization().getId());
        }
        List<com.sep490_g47.smosp.narrowspec.entity.NsCourse> nsCourses = nsCourseRepository.findByCourseId(course.getId());
        for (var nc : nsCourses) {
            specIds.add(nc.getNarrowSpec().getSpecialization().getId());
        }

        return CourseDetailResponse.builder()
                .id(course.getId())
                .code(course.getCode())
                .name(course.getName())
                .credits(course.getCredits())
                .description(course.getDescription())
                .countsTowardGpa(course.getCountsTowardGpa())
                .isActive(course.getIsActive())
                .specializationIds(new ArrayList<>(specIds))
                .prerequisiteGroups(prerequisiteGroups)
                .learningResources(resources)
                .createdAt(course.getCreatedAt())
                .updatedAt(course.getUpdatedAt())
                .build();
    }

    private LearningResourceResponse mapToLearningResourceResponse(LearningResource lr) {
        return LearningResourceResponse.builder()
                .id(lr.getId())
                .title(lr.getTitle())
                .url(lr.getUrl())
                .resourceType(lr.getResourceType())
                .displayOrder(lr.getDisplayOrder())
                .createdAt(lr.getCreatedAt())
                .updatedAt(lr.getUpdatedAt())
                .build();
    }

    private boolean isContentManagerOrAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(grantedAuthority -> grantedAuthority.getAuthority().equals("ROLE_CONTENT_MANAGER") ||
                        grantedAuthority.getAuthority().equals("ROLE_ADMIN"));
    }
}
