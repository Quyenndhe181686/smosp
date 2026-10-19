package com.sep490_g47.smosp.crawler.entity;

import lombok.Getter;

/**
 * Ba hồ sơ trọng số của Trending Weight.
 *
 * VÌ SAO KHÔNG LÀM TRỌNG SỐ RIÊNG TỪNG NARROW SPEC
 * ------------------------------------------------
 * 149 NS × 3 trọng số = 447 tham số, không có cách nào justify từng con số trước
 * hội đồng. Ba hồ sơ thì chỉ phải bảo vệ 9 con số, và mỗi con số gắn với một lập
 * luận về ĐẶC TÍNH DỮ LIỆU chứ không phải sở thích.
 *
 * VÌ SAO SPARSE PHẢI LÀ (1, 0, 0) — đây là điểm quan trọng nhất
 * -------------------------------------------------------------
 * Trước đây NS thiếu dữ liệu bị ép Sacc = 0 rồi vẫn nhân w_sacc = 0.5. Nhưng
 * chuẩn hoá min-max KHÔNG biến số 0 thành 0 điểm: nó ánh xạ 0 vào vị trí tương
 * đối giữa min và max. Đo thật ngày 2026-08-06:
 *
 *     minSacc = -0.6471 · maxSacc = +1.1667
 *     Sacc = 0  ->  chuẩn hoá thành 35.68 điểm
 *     × w_sacc 0.5  ->  17.84 điểm CHO KHÔNG
 *
 * 71/118 NS (60%) đang nhận 17.84 điểm này mà không đo được gì. Hệ quả: hạng
 * trung bình của nhóm dữ liệu mỏng là 55.2, gần như ngang nhóm trưởng thành
 * (53.8) — dù Svol trung bình chỉ 1.2 so với 24.1.
 *
 * Đặt w_sacc = w_junior = 0 cho SPARSE là cách DUY NHẤT thật sự loại Sacc ra
 * khỏi điểm. Sau khi đổi, hạng trung bình: SPARSE 71.2 · MATURE 26.9 · EMERGING
 * 6.0 — phản ánh đúng lượng bằng chứng mỗi nhóm có.
 *
 * ĐỘ BỀN VỮNG (sensitivity analysis, 12 biến thể)
 * -----------------------------------------------
 * Nhiễu ±10% và ±20% lên từng trọng số, và đổi ngưỡng phân loại EMERGING:
 * Spearman so với bộ gốc đều ≥ 0.94 (phần lớn ≥ 0.98). Kết luận xếp hạng KHÔNG
 * phụ thuộc con số cụ thể — đúng thứ OECD/JRC đòi hỏi ở một chỉ số tổng hợp.
 */
@Getter
public enum TrendingWeightProfile {

    /**
     * Nền dữ liệu lớn và tốc độ đo được đáng tin → khối lượng là tín hiệu chắc
     * nhất, nhưng vẫn để tốc độ có tiếng nói.
     */
    MATURE(0.5, 0.3, 0.2),

    /**
     * Nền nhỏ nhưng đang tăng rõ rệt. Với nền nhỏ, ước lượng mức (Svol) nhiễu
     * hơn ước lượng tốc độ (Sacc), nên đảo trọng tâm sang tốc độ.
     */
    EMERGING(0.2, 0.6, 0.2),

    /**
     * Không đủ dữ liệu để đo tốc độ. Khai báo thẳng: chỉ đo được khối lượng.
     * Thay cho cơ chế fallback ngầm trước đây — vốn ghi w_sacc = 0.5 trong bảng
     * cấu hình nhưng lại ép Sacc = 0 trong code, hai thứ mâu thuẫn nhau.
     */
    SPARSE(1.0, 0.0, 0.0);

    private final double wSvol;
    private final double wSacc;
    private final double wJunior;

    TrendingWeightProfile(double wSvol, double wSacc, double wJunior) {
        this.wSvol = wSvol;
        this.wSacc = wSacc;
        this.wJunior = wJunior;
    }

    /** Nhãn tiếng Việt để hiển thị và đưa vào báo cáo. */
    public String getLabel() {
        return switch (this) {
            case MATURE -> "Ngành ổn định";
            case EMERGING -> "Ngành đang lên";
            case SPARSE -> "Chưa đủ dữ liệu";
        };
    }
}
