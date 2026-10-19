package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "crawler_source")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CrawlerSource extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "adapter_key", unique = true, nullable = false)
    private String adapterKey;

    @Column(name = "is_enabled", nullable = false)
    @Builder.Default
    private Boolean isEnabled = true;

    @Column(name = "schedule_cron")
    private String scheduleCron;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    /**
     * BR-38/BV-40a — tín hiệu "nguồn crawl đang thất bại liên tiếp", để tự động
     * tắt {@link #isEnabled} khi vượt ngưỡng thay vì im lặng chạy hỏng vô thời hạn.
     * Về 0 mỗi khi có một lượt SUCCESS hoặc PARTIAL_SUCCESS.
     */
    @Column(name = "consecutive_failures", nullable = false, columnDefinition = "integer DEFAULT 0")
    @Builder.Default
    private Integer consecutiveFailures = 0;

    /** Mốc lượt FAILED đầu tiên trong chuỗi hiện tại; null khi không có chuỗi fail nào đang chạy. */
    @Column(name = "first_failure_at")
    private LocalDateTime firstFailureAt;

    /** Mốc lượt SUCCESS/PARTIAL_SUCCESS gần nhất — độc lập với {@link #lastRunAt}. */
    @Column(name = "last_success_at")
    private LocalDateTime lastSuccessAt;
}
