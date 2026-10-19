package com.sep490_g47.smosp.crawler.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateKeywordRequest {
    @NotNull(message = "narrowSpecId is required")
    private UUID narrowSpecId;

    @NotBlank(message = "keyword is required")
    private String keyword;

    /**
     * Hạng của từ khoá — quyết định nó có tự đủ điều kiện gán tin hay không.
     *
     * {@code NormalizeItemProcessor} có luật {@code if (!hasCore) continue;}: một
     * narrow spec chỉ được xét nếu khớp ít nhất một từ khoá hạng CORE_*. Nên
     * SUPPORT nghĩa là "tín hiệu yếu, chỉ cộng điểm khi đã có CORE khác khớp".
     *
     * Để trống thì mặc định CORE_BASE, giữ nguyên hành vi của các client cũ vốn
     * chỉ gửi narrowSpecId + keyword.
     */
    @Pattern(regexp = "CORE_IDENTIFIER|CORE_BASE|SUPPORT",
            message = "tier phải là CORE_IDENTIFIER, CORE_BASE hoặc SUPPORT")
    private String tier;

    /**
     * Điểm cộng khi từ khoá này khớp. Do CM tự nhập (quyết định nghiệp vụ
     * 2026-08-06) — hệ thống không ép theo tier, để CM tinh chỉnh được sức nặng
     * của từng từ khoá.
     *
     * Để trống thì suy từ tier theo bảng ERD: CORE_IDENTIFIER 5, CORE_BASE 3,
     * SUPPORT 1.
     *
     * Trần 20 khớp với {@code keyword_scoring_cap}: tổng điểm của một narrow spec
     * bị cắt ở mức đó ({@code Math.min(rawScore, capScore)}), nên một từ khoá đơn
     * lẻ vượt trần chỉ làm cơ chế cap mất tác dụng chứ không thêm ý nghĩa gì.
     */
    @Min(value = 1, message = "score tối thiểu là 1")
    @Max(value = 20, message = "score tối đa là 20 (bằng keyword_scoring_cap)")
    private Integer score;
}
