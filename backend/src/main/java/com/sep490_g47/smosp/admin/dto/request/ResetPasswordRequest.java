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
public class ResetPasswordRequest {

    /**
     * BV-05/GBV-01 — password Admin đặt lại cho người khác cũng là password tạm,
     * chịu đúng ràng buộc như {@code CreateStaffRequest}.
     *
     * Siết cùng lúc với CreateStaffRequest chứ không để lại: hai endpoint này dùng
     * CHUNG một hàm kiểm ở màn Admin (validatePassword trong CmAccountsPage), nên
     * chỉ siết một bên là để nguyên đường vòng — vẫn đặt được password yếu bằng
     * cách gọi thẳng endpoint còn lại.
     */
    @NotBlank
    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
        message = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    )
    private String newPassword;
}
