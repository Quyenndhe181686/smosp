package com.sep490_g47.smosp.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Số liệu tổng hợp của một nhóm tài khoản (Sinh viên hoặc Content Manager).
 * Trang danh sách chỉ phân trang được phần hiển thị, nên các con số tổng phải
 * lấy riêng thay vì cộng dồn ở frontend.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserStatsResponse {
    private String role;
    private long total;
    private long active;
    private long inactive;
    /** Số tài khoản mới tạo kể từ đầu tháng hiện tại. */
    private long newThisMonth;
}
