package com.sep490_g47.smosp.narrowspec.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "narrow_spec")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NarrowSpecialization extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialization_id", nullable = false)
    private Specialization specialization;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_published", nullable = false)
    @Builder.Default
    private Boolean isPublished = false;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "current_tw", precision = 5, scale = 2)
    private java.math.BigDecimal currentTw;

    /**
     * Công thức đã sinh ra {@link #currentTw} — xem
     * {@code TrendingWeightProposal.TW_FORMULA_VERSION_*}.
     *
     * NULL khi {@code currentTw} còn NULL: phiên bản của một giá trị chưa tồn tại thì
     * cũng không tồn tại. Cặp này luôn được ghi cùng lúc lúc duyệt đề xuất.
     */
    @Column(name = "current_tw_formula_version")
    private Short currentTwFormulaVersion;

    // Ba thành phần cấu thành nên current_tw, lưu lại ở dạng THÔ (chưa chuẩn hoá) tại
    // lần duyệt gần nhất. Có chúng thì màn duyệt mới hiện được "cũ → mới" cho từng
    // thành phần thay vì chỉ cho TW tổng.
    //
    // KHÔNG khai precision/scale như current_tw: current_tw là điểm 0..100 nên (5,2)
    // vừa đủ, còn svol là số lượng tin tuyển dụng (có thể hàng nghìn) và sacc/junior
    // là tỷ lệ 0..1 — ba thang đo khác nhau. Để mặc định cho khớp cột *_new bên
    // trending_weight_proposal, vốn cũng không khai precision.
    @Column(name = "current_svol")
    private java.math.BigDecimal currentSvol;

    @Column(name = "current_sacc")
    private java.math.BigDecimal currentSacc;

    @Column(name = "current_junior_ratio")
    private java.math.BigDecimal currentJuniorRatio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "curriculum_id")
    private com.sep490_g47.smosp.curriculum.entity.Curriculum curriculum;
}
