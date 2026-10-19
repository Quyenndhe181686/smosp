package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
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

import java.util.UUID;

@Entity
@Table(name = "raw_job")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RawJob extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private CrawlBatch batch;

    @Column(name = "external_id")
    private String externalId;

    @Column(name = "title_raw", columnDefinition = "TEXT")
    private String titleRaw;

    @Column(name = "raw_payload", columnDefinition = "TEXT", nullable = false)
    private String rawPayload;

    /**
     * Dấu vân tay của ĐÚNG những trường normalize đọc — xem
     * {@code RawJobContentHash}. Dùng thay cho việc so cả chuỗi
     * {@link #rawPayload} khi quyết định một tin có thật sự đổi hay không.
     *
     * Null với bản ghi tạo trước khi có cột này; {@code persistPage} tự tính bù
     * từ payload đang lưu ở lần crawl kế tiếp.
     */
    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(name = "normalize_status", nullable = false)
    @Builder.Default
    private String normalizeStatus = "PENDING";

    @Column(name = "normalize_error", columnDefinition = "TEXT")
    private String normalizeError;
}
