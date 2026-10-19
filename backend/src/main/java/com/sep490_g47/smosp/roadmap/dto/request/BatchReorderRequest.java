package com.sep490_g47.smosp.roadmap.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchReorderRequest {

    @NotNull(message = "Danh sách thay đổi không được để trống")
    private List<ItemMove> moves;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemMove {
        @NotNull(message = "ID môn học không được để trống")
        private UUID courseId;

        @NotNull(message = "Kỳ đích không được để trống")
        private Integer targetTerm;

        @Builder.Default
        private boolean acknowledgedRisk = false;
    }
}
