package com.sep490_g47.smosp.tagmap.service;

import com.sep490_g47.smosp.tagmap.dto.response.TagMapSuggestionResponse;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapSyncResponse;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Suy ra ánh xạ kỹ năng → chuyên ngành hẹp từ chương trình học, thay vì bắt CM
 * nhập tay từng mục:
 *
 * <p>Kỹ năng của một CNH = kỹ năng của các môn trong {@code ns_course}
 * ∪ kỹ năng của các môn TIÊN QUYẾT TRỰC TIẾP của những môn đó, với điều kiện môn
 * tiên quyết cũng thuộc {@code spec_course} của chuyên ngành chứa CNH.
 *
 * <p>Chỉ THÊM mục còn thiếu, không bao giờ xoá/sửa mục CM đã cấu hình — trọng số
 * và phân loại do CM chỉnh tay luôn được giữ nguyên.
 */
public interface TagMapDerivationService {

    /** Các mục suy ra được nhưng CHƯA có trong tag_map của CNH (để CM xem trước). */
    List<TagMapSuggestionResponse> getSuggestions(UUID narrowSpecId);

    /** Ghi các mục còn thiếu vào tag_map của CNH. */
    TagMapSyncResponse syncFromCourses(UUID narrowSpecId);

    /**
     * Đồng bộ mọi CNH bị ảnh hưởng khi kỹ năng của các môn này thay đổi: CNH chứa
     * trực tiếp môn đó, và CNH chứa môn lấy nó làm tiên quyết.
     *
     * @return tên các CNH thực sự được thêm mục mới
     */
    List<String> syncNarrowSpecsAffectedByCourses(Collection<UUID> courseIds);
}
