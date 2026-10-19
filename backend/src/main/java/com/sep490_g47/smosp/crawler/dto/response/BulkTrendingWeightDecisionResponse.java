package com.sep490_g47.smosp.crawler.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Kết quả một lượt duyệt / từ chối hàng loạt.
 *
 * Mỗi đề xuất chạy transaction RIÊNG, nên một cái hỏng không kéo đổ cả lượt: phần
 * thành công vẫn được ghi, phần hỏng trả về kèm lý do. Đây là lý do response phải
 * liệt kê tới từng dòng thay vì chỉ đếm — CM cần biết ĐÍCH DANH CNH nào chưa xử lý
 * được để xử tay, chứ không phải một con số "5 thất bại" rồi tự đi dò.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkTrendingWeightDecisionResponse {

    private int total;
    private int succeeded;
    private int failed;
    private List<Item> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private UUID proposalId;
        private String narrowSpecCode;
        private boolean success;
        /** Lý do hỏng, chỉ có khi {@code success = false}. */
        private String errorMessage;
    }
}
