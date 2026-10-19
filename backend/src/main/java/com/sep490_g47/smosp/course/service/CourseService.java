package com.sep490_g47.smosp.course.service;

import com.sep490_g47.smosp.course.dto.response.CourseDetailResponse;
import com.sep490_g47.smosp.course.dto.request.CourseRequest;
import com.sep490_g47.smosp.course.dto.response.CourseOptionResponse;
import com.sep490_g47.smosp.course.dto.response.CourseResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface CourseService {
    Page<CourseResponse> getCourses(String code, String name, Boolean isActive, Boolean countsTowardGpa, Pageable pageable);

    /** Tìm môn học đang hoạt động theo mã hoặc tên, trả về bản rút gọn cho ô chọn. */
    List<CourseOptionResponse> searchCourseOptions(String keyword, int limit);
    CourseDetailResponse getCourseDetail(UUID id);
    CourseResponse createCourse(CourseRequest request);
    CourseResponse updateCourse(UUID id, CourseRequest request);
    void deleteCourse(UUID id);
    CourseDetailResponse updatePrerequisites(UUID id, List<List<UUID>> prerequisiteGroups);
}
