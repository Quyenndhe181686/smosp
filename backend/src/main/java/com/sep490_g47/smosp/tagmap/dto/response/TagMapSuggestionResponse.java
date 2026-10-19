package com.sep490_g47.smosp.tagmap.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Một mục ánh xạ được SUY RA từ môn học của chuyên ngành hẹp — chưa nằm trong
 * tag_map. Khác {@link TagMapResponse} ở chỗ không có id (chưa lưu) và mang thêm
 * {@code reason} để CM biết kỹ năng này đến từ môn nào.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TagMapSuggestionResponse {
    private String sourceType;
    private UUID sourceId;
    private String sourceName;
    private String mappingType;
    private BigDecimal weight;
    /** Nguồn gốc: môn trong combo, hay môn tiên quyết của môn trong combo. */
    private String reason;
    /** true khi kỹ năng đến từ môn tiên quyết chứ không phải môn trong combo. */
    private Boolean fromPrerequisite;
}
