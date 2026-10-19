package com.sep490_g47.smosp.tagmap.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(
    name = "tag_map",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"narrow_spec_id", "source_type", "source_id"})
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class TagMap extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "narrow_spec_id", nullable = false)
    private UUID narrowSpecId;

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    @Column(name = "mapping_type", nullable = false, length = 50)
    @Builder.Default
    private String mappingType = "SHARED";

    @Column(nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal weight = BigDecimal.ONE;

    @Column(columnDefinition = "TEXT")
    private String rationale;

    @Column(name = "extraction_source", length = 100)
    private String extractionSource;

    @Column(columnDefinition = "varchar(50) NOT NULL DEFAULT 'APPROVED'", nullable = false)
    @Builder.Default
    private String status = "APPROVED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private com.sep490_g47.smosp.auth.entity.UserAccount reviewedBy;

    @Column(name = "reviewed_at")
    private java.time.LocalDateTime reviewedAt;
}
