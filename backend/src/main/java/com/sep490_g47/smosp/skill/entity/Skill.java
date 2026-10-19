package com.sep490_g47.smosp.skill.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "skill")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Skill extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "specialization_id", nullable = false)
    private UUID specializationId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @OneToMany(mappedBy = "skill", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SkillAlias> aliases = new ArrayList<>();

    @Column(length = 255)
    private String category;

    @Column(length = 255)
    private String domain;

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
