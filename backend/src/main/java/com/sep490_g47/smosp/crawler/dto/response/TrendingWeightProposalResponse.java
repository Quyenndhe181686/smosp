package com.sep490_g47.smosp.crawler.dto.response;

import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendingWeightProposalResponse {
    private UUID id;
    private UUID narrowSpecId;
    private String narrowSpecCode;
    private String narrowSpecName;
    private UUID specId;
    private UUID majorId;
    private BigDecimal svolNew;
    private BigDecimal saccNew;
    private BigDecimal juniorRatioNew;
    private BigDecimal twNew;
    private BigDecimal twOld;

    /**
     * Giá trị ba thành phần đang áp dụng tại thời điểm đề xuất được tạo — cặp "cũ" của
     * svolNew / saccNew / juniorRatioNew.
     *
     * <b>NULL là giá trị hợp lệ</b>, nghĩa là "chưa từng có đề xuất nào được duyệt cho
     * CNH này" hoặc "đề xuất tạo trước khi ba cột này tồn tại". Nơi hiển thị phải phân
     * biệt NULL với 0 — Svol bằng 0 (không có tin tuyển dụng nào) là một kết quả đo
     * được thật, không phải thiếu dữ liệu.
     *
     * Lưu ý thang đo khi hiển thị: svol là SỐ LƯỢNG tin, còn sacc và juniorRatio là
     * TỶ LỆ 0..1 — phải nhân 100 mới ra phần trăm.
     */
    private BigDecimal svolOld;
    private BigDecimal saccOld;
    private BigDecimal juniorRatioOld;
    private TrendingWeightProposalStatus status;

    /**
     * Hồ sơ trọng số áp dụng cho đề xuất này, kèm nhãn tiếng Việt sẵn để hiển thị.
     *
     * Màn duyệt cần biết để không vẽ delta vô nghĩa: với {@code SPARSE} thì
     * w_sacc = w_junior = 0, nên TW bằng đúng Svol chuẩn hoá và hai cột Sacc / Junior
     * luôn là 0 — không phải vì đo được 0 mà vì bị loại khỏi công thức.
     */
    private String profile;
    private String profileLabel;

    private boolean isFallback;

    /**
     * Phiên bản công thức sinh ra {@code twNew}: 1 = min-max theo đợt (phụ thuộc cohort,
     * không so sánh được giữa hai đợt), 2 = trần cố định {@code tw_svol_cap}.
     * So {@code twNew} của hai đề xuất khác phiên bản là so hai thang đo khác nhau.
     */
    private Short twFormulaVersion;

    /**
     * Công thức sinh ra {@code twOld}. LỆCH với {@code twFormulaVersion} nghĩa là hai
     * con số thuộc hai thang đo khác nhau — nơi hiển thị phải ẩn phần so sánh
     * "cũ → mới", chỉ hiện giá trị mới.
     */
    private Short twOldFormulaVersion;
    private Integer version;
    private String note;
    private LocalDateTime reviewedAt;
    private String reviewedBy;
    private LocalDateTime createdAt;

    /**
     * Phiên crawl sinh ra đề xuất — danh tính THẬT của "đợt". NULL với đề xuất tạo
     * ngoài pipeline (calculate thủ công, recovery sau restart) và với dữ liệu cũ
     * có trước khi cột {@code crawl_batch_id} tồn tại.
     *
     * Màn duyệt gom nhóm theo đúng trường này. Trước đây nó phải tự đoán "đợt" bằng
     * cách cụm các proposal tạo cách nhau dưới 90 giây, và tự dò người chạy bằng
     * cách so thời điểm tạo với {@code finishedAt} của từng batch trong vòng 1 giờ —
     * cả hai đều là suy đoán, giờ thay bằng dữ liệu thật.
     */
    private UUID crawlBatchId;
    private LocalDateTime crawlBatchStartedAt;
    private String crawlBatchScopeName;
    private String crawlBatchTriggeredBy;
}
