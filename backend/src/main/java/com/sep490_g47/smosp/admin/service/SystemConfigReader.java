package com.sep490_g47.smosp.admin.service;

import com.sep490_g47.smosp.admin.repository.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Đọc giá trị số từ bảng {@code system_config}, không bao giờ ném ra ngoài.
 *
 * VÌ SAO CẦN: {@code config_value} cố ý là {@code String} vì bảng dùng chung cho
 * mọi loại config, nên tầng ghi không thể biết key nào sẽ được đọc thành số mà
 * không hard-code danh sách key. Trách nhiệm phòng thủ thuộc tầng tiêu thụ — nơi
 * biết rõ mình cần số và biết giá trị thay thế hợp lý.
 *
 * Hai kiểu vỡ mà lớp này chặn, khi Admin gõ nhầm một giá trị:
 *
 *   1. 500 thẳng. {@code tw_window_days = "30a"} → CM gọi
 *      POST /api/cm/crawler/trending-weight/calculate → 500, không proposal nào
 *      được tính, kể cả những Specialization không liên quan.
 *
 *   2. Tê liệt im lặng — khó phát hiện hơn nhiều. {@code keyword_scoring_cap} sai
 *      → CM gọi POST /api/crawler/normalize-all → HTTP 200 bình thường, nhưng vì
 *      đây là config toàn cục, vòng try/catch theo từng Specialization bắt lỗi ở
 *      MỌI lần lặp → {@code failed = tổng số Specialization}, {@code success = 0}.
 *      Rất dễ bị đọc thành "hôm nay không có job hợp lệ" thay vì "tính năng chết
 *      vì config sai".
 *
 * Nên khi giá trị CÓ nhưng sai định dạng, lớp này log {@code WARN} nêu đích danh
 * key và giá trị — thứ phân biệt được hai cách đọc ở trên. Còn khi key vắng mặt
 * thì im lặng dùng mặc định, vì đó là trạng thái bình thường của môi trường mới.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SystemConfigReader {

    private final SystemConfigRepository systemConfigRepository;

    public int getInt(String key, int fallback) {
        String raw = rawValue(key);
        if (raw == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            warnUnparseable(key, raw, String.valueOf(fallback));
            return fallback;
        }
    }

    public double getDouble(String key, double fallback) {
        String raw = rawValue(key);
        if (raw == null) {
            return fallback;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException e) {
            warnUnparseable(key, raw, String.valueOf(fallback));
            return fallback;
        }
    }

    /** Chuỗi thô, trim, rỗng cũng coi là vắng mặt (giữ cùng ngữ nghĩa với @NotBlank ở phía ghi). */
    public String getString(String key, String fallback) {
        String raw = rawValue(key);
        if (raw == null || raw.trim().isEmpty()) {
            return fallback;
        }
        return raw.trim();
    }

    private String rawValue(String key) {
        return systemConfigRepository.findByConfigKey(key)
                .map(c -> c.getConfigValue())
                .orElse(null);
    }

    private void warnUnparseable(String key, String raw, String fallback) {
        log.warn("[system-config] Key '{}' co gia tri '{}' khong doc duoc thanh so — dung mac dinh {}. "
                + "Admin sua lai gia tri nay trong man hinh cau hinh he thong.", key, raw, fallback);
    }
}
