package com.sep490_g47.smosp.roadmap.dto.request;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class ReorderRoadmapItemsRequest {
    private UUID courseId;              // course được chuyển kỳ
    private Integer targetTerm;          // kỳ ĐÍCH sau khi chuyển
    private Boolean acknowledgedRisk;    // xác nhận đọc/đồng ý cảnh báo rủi ro học vượt (bắt buộc khi học vượt)
}