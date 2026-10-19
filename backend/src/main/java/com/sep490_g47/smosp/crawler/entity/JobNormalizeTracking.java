package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "job_normalize_tracking",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"raw_job_id", "specialization_id"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobNormalizeTracking extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "raw_job_id", nullable = false)
    private RawJob rawJob;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialization_id", nullable = false)
    private Specialization specialization;

    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    @Column(columnDefinition = "TEXT")
    private String error;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    /**
     * Số lần tracking này đã được PipelineRecoveryRunner cố khôi phục sau khi server
     * khởi động lại. Bộ đếm được tăng và COMMIT trước khi normalize chạy, nên nếu
     * chính payload của nó làm server chết thì lần khởi động sau vẫn thấy số đã tăng.
     * Vượt ngưỡng thì bị loại ra khỏi hàng đợi khôi phục — đây là thứ làm gãy vòng
     * lặp "restart ➔ normalize ➔ chết ➔ restart".
     *
     * Về 0 mỗi khi tracking được đá lại về PENDING bởi một đợt crawl mới
     * (resetToPendingByRawJobId), vì khi đó là việc mới chứ không phải việc cũ lỗi.
     */
    @Column(name = "recovery_attempts", nullable = false, columnDefinition = "integer DEFAULT 0")
    @Builder.Default
    private Integer recoveryAttempts = 0;
}
