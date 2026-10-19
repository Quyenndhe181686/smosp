package com.sep490_g47.smosp.crawler.entity;

public enum TrendingWeightProposalStatus {
    PENDING,
    ACCEPTED,
    REJECTED,
    /**
     * Hệ thống tự huỷ (job hết hạn — xem B31/R56, chưa triển khai ở đây), khác
     * với {@link #REJECTED} do CM chủ động xem xét rồi từ chối. Tách trạng thái
     * để chỉ số {@code rejectedTwProposals} không trộn hai ý nghĩa khác hẳn nhau:
     * "CM đã xem và từ chối" so với "không ai xem, hệ thống tự huỷ".
     */
    AUTO_REJECTED,

    /**
     * Bị một đợt tính SAU của cùng Chuyên ngành hẹp thay thế khi vẫn còn PENDING.
     *
     * Trước đây mỗi lần chạy {@code calculateTrendingWeights} đều tạo proposal mới
     * cho MỌI narrow spec mà không đụng tới bản PENDING cũ, nên cào N lần là mỗi
     * CNH có N proposal cùng chờ duyệt. Màn duyệt lọc mặc định theo "đợt gần nhất"
     * nên chỉ thấy lớp trên cùng: CM duyệt hết lớp đó, danh sách nạp lại và lộ ra
     * lớp cũ hơn — nhìn như "càng duyệt càng đẻ thêm".
     *
     * Tách khỏi {@link #AUTO_REJECTED}: "có số liệu mới hơn nên bản này hết giá
     * trị" không phải là "để quá 7 ngày không ai ngó tới". Gộp lại sẽ làm chỉ số
     * đề xuất bị bỏ quên mất ý nghĩa.
     */
    SUPERSEDED
}
