package com.sep490_g47.smosp.interest.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "interest_option")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class InterestOption extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "specialization_id", nullable = false)
    private UUID specializationId;

    @Column(nullable = false, length = 255)
    private String label;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 255)
    private String category;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "varchar(50) NOT NULL DEFAULT 'MANUAL'", nullable = false)
    @Builder.Default
    private String source = "MANUAL";

    @Column(columnDefinition = "varchar(50) NOT NULL DEFAULT 'APPROVED'", nullable = false)
    @Builder.Default
    private String status = "APPROVED";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private com.sep490_g47.smosp.auth.entity.UserAccount reviewedBy;

    @Column(name = "reviewed_at")
    private java.time.LocalDateTime reviewedAt;
}
