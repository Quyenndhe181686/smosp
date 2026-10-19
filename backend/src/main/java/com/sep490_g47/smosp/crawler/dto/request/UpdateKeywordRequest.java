package com.sep490_g47.smosp.crawler.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Mọi trường đều nullable — null nghĩa là "không đổi", không phải "xoá".
 */
@Data
public class UpdateKeywordRequest {
    private String keyword;
    private Boolean active;

    /** Xem {@link CreateKeywordRequest#getTier()}. */
    @Pattern(regexp = "CORE_IDENTIFIER|CORE_BASE|SUPPORT",
            message = "tier phải là CORE_IDENTIFIER, CORE_BASE hoặc SUPPORT")
    private String tier;

    /**
     * Xem {@link CreateKeywordRequest#getScore()}.
     *
     * Khác với create: ở đây để trống là GIỮ NGUYÊN điểm cũ, không suy lại từ
     * tier. Đổi tier mà muốn điểm chạy theo thì gửi kèm score.
     */
    @Min(value = 1, message = "score tối thiểu là 1")
    @Max(value = 20, message = "score tối đa là 20 (bằng keyword_scoring_cap)")
    private Integer score;
}
