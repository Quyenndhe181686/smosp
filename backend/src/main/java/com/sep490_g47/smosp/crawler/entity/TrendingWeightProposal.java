package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "trending_weight_proposal", indexes = {
    @Index(name = "idx_tw_proposal_ns_version", columnList = "narrow_spec_id, version"),
    @Index(name = "idx_tw_proposal_batch", columnList = "crawl_batch_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TrendingWeightProposal extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "narrow_spec_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private NarrowSpecialization narrowSpec;

    @Column(name = "svol_new", nullable = false)
    private BigDecimal svolNew;

    @Column(name = "sacc_new", nullable = false)
    private BigDecimal saccNew;

    @Column(name = "junior_ratio_new", nullable = false)
    private BigDecimal juniorRatioNew;

    @Column(name = "tw_new", nullable = false)
    private BigDecimal twNew;

    @Column(name = "tw_old")
    private BigDecimal twOld;

    // Ảnh chụp ba thành phần đang áp dụng tại thời điểm TẠO proposal — cùng ngữ nghĩa
    // với tw_old: "đề xuất này được tính để thay cho cái gì".
    //
    // NULL với mọi proposal tạo trước V5 (giá trị cũ khi đó không được lưu ở đâu, suy
    // ngược lại sẽ là bịa số), và với CNH chưa từng có proposal nào được duyệt. Nơi
    // hiển thị phải phân biệt NULL với 0 — 0 là một giá trị đo được thật.
    @Column(name = "svol_old")
    private BigDecimal svolOld;

    @Column(name = "sacc_old")
    private BigDecimal saccOld;

    @Column(name = "junior_ratio_old")
    private BigDecimal juniorRatioOld;

    /**
     * Phiên bản công thức đã sinh ra {@code twNew} — xem V6__add_tw_formula_version.sql.
     *
     * <ul>
     *   <li><b>1</b> — Svol VÀ Sacc chuẩn hoá bằng min-max theo đợt. Giá trị phụ thuộc
     *       vào việc đợt cào đó gồm những CNH nào, nên KHÔNG so sánh được giữa hai đợt.</li>
     *   <li><b>2</b> — Svol theo trần cố định {@code tw_svol_cap}, Sacc theo biên đối
     *       xứng {@code tw_sacc_cap}. Cả hai chỉ phụ thuộc chính CNH đó.</li>
     * </ul>
     *
     * So sánh {@code twNew} của hai đề xuất khác phiên bản là so hai thang đo khác nhau.
     */
    public static final short TW_FORMULA_VERSION_MINMAX = 1;
    public static final short TW_FORMULA_VERSION_FIXED_CAP = 2;

    /** Công thức mà mã nguồn hiện tại đang dùng. Tăng khi đổi cách chuẩn hoá. */
    public static final short CURRENT_TW_FORMULA_VERSION = TW_FORMULA_VERSION_FIXED_CAP;

    @Column(name = "tw_formula_version", nullable = false)
    @Builder.Default
    private Short twFormulaVersion = CURRENT_TW_FORMULA_VERSION;

    /**
     * Công thức đã sinh ra {@link #twOld} — ảnh chụp của
     * {@code narrowSpec.currentTwFormulaVersion} tại thời điểm tạo đề xuất.
     *
     * Lệch với {@link #twFormulaVersion} nghĩa là {@code twOld} và {@code twNew} thuộc
     * HAI THANG ĐO khác nhau, không được đặt cạnh nhau để so sánh. Mặc định 1 cho dữ
     * liệu cũ, đúng theo định nghĩa: mọi giá trị có trước V7 đều do min-max sinh ra.
     */
    @Column(name = "tw_old_formula_version", nullable = false)
    @Builder.Default
    private Short twOldFormulaVersion = TW_FORMULA_VERSION_MINMAX;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private TrendingWeightProposalStatus status = TrendingWeightProposalStatus.PENDING;

    @Column(name = "is_fallback", nullable = false)
    @Builder.Default
    private boolean isFallback = false;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private UserAccount reviewedBy;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    /**
     * Hồ sơ trọng số đã dùng cho chính lần tính này. Lưu lại để mỗi con số TW
     * truy vết được về bộ trọng số sinh ra nó — bảng cấu hình có thể đổi sau,
     * nhưng proposal cũ vẫn giải thích được.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "profile")
    private TrendingWeightProfile profile;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    /**
     * Phiên crawl đã sinh ra đề xuất này. NULL khi đợt tính không xuất phát từ một
     * batch cụ thể — {@code POST /trending-weight/calculate} chạy tay,
     * PipelineRecoveryRunner sau restart, hay vòng dọn của OrphanTrackingSweeper.
     *
     * VÌ SAO CẦN: trước đây bảng này không có đường nào nối về {@code crawl_batch},
     * nên màn duyệt của CM phải TỰ ĐOÁN "đợt" ở phía client bằng cách gom các
     * proposal có thời điểm tạo cách nhau dưới 90 giây. Một lần bấm "Thu thập tất
     * cả ngành" chạy 2 luồng song song và kéo dài hàng chục phút, nên đúng một đợt
     * cào bị cắt vụn thành hàng chục "đợt" giả — CM phải bấm "Duyệt tất cả" hàng
     * chục lần cho một lần cào. Có cột này thì "đợt" là dữ liệu thật, không phải suy
     * đoán theo đồng hồ.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crawl_batch_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private CrawlBatch crawlBatch;
}
