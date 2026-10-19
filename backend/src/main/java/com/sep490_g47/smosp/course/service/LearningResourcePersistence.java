package com.sep490_g47.smosp.course.service;

import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.entity.LearningResource;
import com.sep490_g47.smosp.course.enums.ResourceType;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.course.repository.LearningResourceRepository;
import com.sep490_g47.smosp.course.util.CourseConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Phần ghi DB của luồng quản lý learning resource, tách khỏi {@link CourseServiceImpl}
 * để transaction chỉ bọc thao tác DB, không bọc lời gọi Cloudinary.
 *
 * Bắt buộc là bean riêng: nếu để chung class với method orchestration thì
 * self-invocation không đi qua Spring proxy và @Transactional bị bỏ qua hoàn toàn.
 */
@Component
@RequiredArgsConstructor
public class LearningResourcePersistence {

    private final CourseRepository courseRepository;
    private final LearningResourceRepository learningResourceRepository;

    @Transactional(readOnly = true)
    public LearningResource findRequired(UUID resourceId) {
        return learningResourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning resource not found"));
    }

    @Transactional
    public LearningResource createResource(UUID courseId, String title, ResourceType type, String url) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CourseConstants.ERR_COURSE_NOT_FOUND));

        // BV-23: toi da 10 learning resource / course, khong tang nao ep truoc day.
        // Nguong la "du 10 van hop le", chi chan cai thu 11 — >= 10 ngay truoc khi
        // insert cai moi la dung: 10 cai da co + 1 cai sap them = 11.
        if (learningResourceRepository.countByCourseId(courseId) >= 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Course đã đạt tối đa 10 learning resource");
        }

        return learningResourceRepository.save(LearningResource.builder()
                .course(course)
                .title(title)
                .url(url)
                .resourceType(type)
                .displayOrder(0)
                .build());
    }

    /** {@code newUrl} null nghĩa là giữ nguyên URL cũ (không có file/link mới gửi lên). */
    @Transactional
    public LearningResource updateResource(UUID resourceId, String title, ResourceType type,
                                           String newUrl, Integer displayOrder) {
        LearningResource resource = learningResourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning resource not found"));

        if (title != null) {
            resource.setTitle(title);
        }
        if (displayOrder != null) {
            resource.setDisplayOrder(displayOrder);
        }
        if (type != null) {
            resource.setResourceType(type);
        }
        if (newUrl != null) {
            resource.setUrl(newUrl);
        }

        return learningResourceRepository.save(resource);
    }

    @Transactional
    public void deleteById(UUID resourceId) {
        LearningResource resource = learningResourceRepository.findById(resourceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning resource not found"));
        learningResourceRepository.delete(resource);
    }
}
