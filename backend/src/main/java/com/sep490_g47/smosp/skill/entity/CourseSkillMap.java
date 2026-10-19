package com.sep490_g47.smosp.skill.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(
    name = "course_skill_map",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"course_id", "skill_id"})
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CourseSkillMap extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(name = "skill_id", nullable = false)
    private UUID skillId;

    @Column(name = "confidence_score", precision = 5, scale = 2)
    private java.math.BigDecimal confidenceScore;

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
