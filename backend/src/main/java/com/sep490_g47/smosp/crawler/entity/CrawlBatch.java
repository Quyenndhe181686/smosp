package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "crawl_batch")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CrawlBatch extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_id", nullable = false)
    private CrawlerSource source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "triggered_by")
    private UserAccount triggeredBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_specialization_id")
    private Specialization scopeSpecialization;

    /** RUNNING · SUCCESS · PARTIAL_SUCCESS · FAILED · CANCELLED */
    @Column(nullable = false)
    @Builder.Default
    private String status = "RUNNING";

    /**
     * Cờ xin dừng phiên crawl. Người bấm dừng chỉ ĐẶT cờ này rồi trả về ngay —
     * luồng crawl đang chạy tự đọc giữa hai trang và thoát êm.
     *
     * Cố ý KHÔNG huỷ thread thẳng tay: đang giữa lúc ghi một trang xuống DB mà bị
     * ngắt thì batch mắc kẹt nửa vời, không ai chốt trạng thái. Dừng hợp tác kiểu
     * này chậm hơn (tối đa ~1 trang, khoảng vài giây) nhưng luôn chốt được
     * status và giữ nguyên phần dữ liệu đã cào.
     */
    @Column(name = "cancel_requested", nullable = false, columnDefinition = "boolean DEFAULT false")
    @Builder.Default
    private Boolean cancelRequested = false;

    /**
     * Ai bấm dừng và vì sao — cùng khuôn với {@code deletedBy}/{@code deletedReason}
     * của ContentErrorReport.
     *
     * Không có hai trường này thì Content Manager đang cào dở bị Admin dừng sẽ thấy
     * phiên tự nhiên chết mà không hiểu chuyện gì: không biết ai dừng, không biết lý
     * do, và rất dễ tưởng hệ thống hỏng rồi bấm chạy lại — đúng thứ Admin vừa muốn
     * ngăn.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by")
    private UserAccount cancelledBy;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    @Column(name = "total_fetched", nullable = false)
    @Builder.Default
    private Integer totalFetched = 0;

    @Column(name = "total_parsed", nullable = false)
    @Builder.Default
    private Integer totalParsed = 0;

    @Column(name = "total_errors", nullable = false)
    @Builder.Default
    private Integer totalErrors = 0;

    // Tổng số job nguồn báo có (VnwMeta.nbHits ở page đầu) — mẫu số để tính % tiến
    // độ cào. Nullable: batch cũ chưa có dữ liệu này, và nguồn có thể không trả meta.
    @Column(name = "total_expected")
    private Integer totalExpected;

    @Column(name = "started_at", nullable = false)
    @Builder.Default
    private LocalDateTime startedAt = LocalDateTime.now();

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "error_log", columnDefinition = "TEXT")
    private String errorLog;
}
