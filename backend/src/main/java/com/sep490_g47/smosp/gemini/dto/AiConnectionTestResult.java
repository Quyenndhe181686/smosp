package com.sep490_g47.smosp.gemini.dto;

import lombok.Builder;
import lombok.Data;

/**
 * AC-56-03 — kết quả bấm "Kiểm tra kết nối" trên màn cấu hình AI.
 *
 * KHÔNG chứa API key dưới bất kỳ dạng nào: {@code message} đã được lọc bỏ tham số
 * {@code key=} trước khi trả về, vì thông báo lỗi mạng của RestTemplate có kèm
 * nguyên URL đã gọi — mà URL của Gemini mang API key trên query string.
 */
@Data
@Builder
public class AiConnectionTestResult {

    /** Gọi tới nơi và nhận được phản hồi hợp lệ hay không. */
    private boolean success;

    /** Mô tả ngắn cho Admin đọc. Đã lọc API key. */
    private String message;

    /** Endpoint thật sự đã dùng — để Admin thấy cấu hình vừa lưu có hiệu lực chưa. */
    private String endpoint;

    /** Model thật sự đã dùng. */
    private String model;

    private long latencyMs;
}
