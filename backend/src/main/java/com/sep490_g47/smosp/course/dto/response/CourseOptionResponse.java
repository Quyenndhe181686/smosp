package com.sep490_g47.smosp.course.dto.response;

import java.util.UUID;

/**
 * Môn học rút gọn cho ô chọn/tìm kiếm phía người dùng cuối — chỉ đủ để hiển thị
 * và gửi kèm id.
 *
 * CỐ Ý không dùng lại {@link CourseResponse}: DTO đó phục vụ màn quản trị của
 * Content Manager nên mang cả {@code description}, {@code countsTowardGpa},
 * {@code isActive}, danh sách môn tiên quyết — không có lý do gì để lộ ra một
 * endpoint mà sinh viên gọi được.
 */
public record CourseOptionResponse(UUID id, String code, String name) {
}
