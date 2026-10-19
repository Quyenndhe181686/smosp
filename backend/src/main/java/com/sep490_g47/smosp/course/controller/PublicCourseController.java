package com.sep490_g47.smosp.course.controller;

import com.sep490_g47.smosp.course.dto.response.CourseDetailResponse;
import com.sep490_g47.smosp.course.dto.response.CourseOptionResponse;
import com.sep490_g47.smosp.course.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class PublicCourseController {

    private final CourseService courseService;

    /**
     * Tìm môn học cho ô chọn phía người dùng cuối (màn "Báo lỗi nội dung").
     *
     * Sinh viên KHÔNG gọi được {@code GET /api/courses} — endpoint đó thuộc
     * {@code CmCourseController} và giới hạn {@code hasAnyRole('CONTENT_MANAGER')}.
     * Trước đây màn báo lỗi vẫn gọi vào đó, nhận 403, rồi nuốt lỗi vào console nên
     * danh sách môn luôn rỗng và mọi từ khoá đều ra "không tìm thấy môn học nào".
     *
     * Đặt ở đây thay vì nới quyền endpoint của CM: endpoint kia trả cả mô tả,
     * trạng thái hoạt động và danh sách môn tiên quyết — nhiều hơn hẳn thứ một ô
     * tìm kiếm cần.
     */
    @GetMapping("/search")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<CourseOptionResponse>> searchCourses(
            @RequestParam(name = "q", required = false) String keyword,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        return ResponseEntity.ok(courseService.searchCourseOptions(keyword, limit));
    }

    @GetMapping("/{id}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<CourseDetailResponse> getCourseDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(courseService.getCourseDetail(id));
    }
}
