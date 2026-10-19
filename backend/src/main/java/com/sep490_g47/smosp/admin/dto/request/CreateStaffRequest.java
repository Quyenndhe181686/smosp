package com.sep490_g47.smosp.admin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStaffRequest {
    @NotBlank
    private String username;

    @NotBlank
    private String displayName;

    /**
     * F-FE14/BV-05/GBV-01 — password tạm phải đủ 4 nhóm ký tự y như mọi password
     * khác trong hệ thống.
     *
     * Trước đây chỉ có {@code @Size}, nên gọi thẳng API đặt được "aaaaaaaa"; màn
     * Admin chỉ chặn 2 nhóm (1 hoa + 1 số) nên ngay cả qua UI cũng lọt "Aaaaaaa1".
     * Ràng buộc ở tầng DTO mới là ràng buộc thật — validate ở FE chỉ để báo lỗi
     * sớm cho người nhập.
     *
     * Regex trùng khớp với {@code RegisterRequest}, {@code ChangePasswordRequest}
     * và {@code NewPasswordRequest}: một quy tắc password duy nhất cho cả hệ thống,
     * không để mỗi luồng tạo tài khoản có một mức chặt riêng.
     */
    @NotBlank
    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
        message = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    )
    private String password;
}
