package com.sep490_g47.smosp.narrowspec.entity;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "narrow_spec_weight_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NarrowSpecWeightConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "narrow_spec_id", nullable = false, unique = true)
    private NarrowSpecialization narrowSpec;

    @Column(name = "alpha_base", nullable = false)
    private BigDecimal alphaBase;

    @Column(name = "w_gpa", nullable = false)
    @Builder.Default
    private BigDecimal wGpa = new BigDecimal("0.04");

    @Column(name = "w_skill", nullable = false)
    @Builder.Default
    private BigDecimal wSkill = new BigDecimal("0.28");

    @Column(name = "w_int", nullable = false)
    @Builder.Default
    private BigDecimal wInt = new BigDecimal("0.68");

    @Column(name = "w_sacc", nullable = false, columnDefinition = "decimal DEFAULT 0.500")
    @Builder.Default
    private BigDecimal wSacc = new BigDecimal("0.500");

    @Column(name = "w_svol", nullable = false, columnDefinition = "decimal DEFAULT 0.300")
    @Builder.Default
    private BigDecimal wSvol = new BigDecimal("0.300");

    @Column(name = "w_junior", nullable = false, columnDefinition = "decimal DEFAULT 0.200")
    @Builder.Default
    private BigDecimal wJunior = new BigDecimal("0.200");

    /**
     * Hồ sơ trọng số hệ thống TỰ gán ở mỗi lần tính Trending Weight, dựa trên đặc
     * tính dữ liệu của NS (xem {@code TrendingWeightProfile}).
     *
     * Ba cột w_svol/w_sacc/w_junior ở trên là GIÁ TRỊ DẪN XUẤT từ hồ sơ này —
     * chúng được ghi lại sau mỗi lần tính để bảng cấu hình luôn khớp hành vi
     * thật. Không sửa tay ba cột đó nữa: lần tính sau sẽ ghi đè. Muốn đổi thì
     * đặt {@link #profileOverride}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "profile")
    private com.sep490_g47.smosp.crawler.entity.TrendingWeightProfile profile;

    /**
     * Hồ sơ do CM chỉ định tay. Khác null thì thắng hồ sơ tự gán.
     *
     * Đây là chỗ DUY NHẤT để can thiệp trọng số. Lý do không cho sửa số thô: 149
     * NS × 3 trọng số = 447 tham số không thể justify từng cái, còn 3 hồ sơ thì
     * chỉ phải bảo vệ 9 con số.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "profile_override")
    private com.sep490_g47.smosp.crawler.entity.TrendingWeightProfile profileOverride;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by", nullable = false)
    private UserAccount updatedBy;
}
