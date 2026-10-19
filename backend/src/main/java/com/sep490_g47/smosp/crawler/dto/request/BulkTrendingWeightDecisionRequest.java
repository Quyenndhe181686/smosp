package com.sep490_g47.smosp.crawler.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Duyệt / từ chối nhiều đề xuất Trending Weight trong MỘT request.
 *
 * Trước đây màn duyệt của CM không có endpoint hàng loạt: nút "Duyệt tất cả" chạy
 * vòng lặp {@code await} gọi POST /proposals/{id}/approve từng cái một. Với một đợt
 * hơn trăm CNH thì đó là hơn trăm request tuần tự, mỗi cái một transaction và một
 * lượt qua Spring Security — chậm, và nếu CM đóng tab giữa chừng thì một nửa đã
 * duyệt, một nửa còn PENDING mà không có gì ghi lại là chuyện đó đã xảy ra.
 *
 * CỐ Ý bắt liệt kê ID rõ ràng thay vì nhận một cờ kiểu "duyệt sạch mọi thứ đang
 * PENDING": danh sách trên màn hình luôn có bộ lọc, nên "tất cả" ở client và "tất
 * cả" ở server là hai tập khác nhau. Gửi thẳng ID đang hiển thị thì không bao giờ
 * duyệt nhầm thứ CM chưa nhìn thấy.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkTrendingWeightDecisionRequest {

    @NotEmpty(message = "Phải chọn ít nhất một đề xuất")
    @Size(max = 1000, message = "Mỗi lần xử lý tối đa 1000 đề xuất")
    private List<UUID> proposalIds;
}
