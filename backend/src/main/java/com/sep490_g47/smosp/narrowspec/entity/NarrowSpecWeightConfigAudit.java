package com.sep490_g47.smosp.narrowspec.entity;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "narrow_spec_weight_config_audit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NarrowSpecWeightConfigAudit extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "narrow_spec_id", nullable = false)
    private NarrowSpecialization narrowSpec;

    @Column(name = "alpha_base_old")
    private BigDecimal alphaBaseOld;

    @Column(name = "alpha_base_new")
    private BigDecimal alphaBaseNew;

    @Column(name = "w_gpa_old")
    private BigDecimal wGpaOld;

    @Column(name = "w_gpa_new")
    private BigDecimal wGpaNew;

    @Column(name = "w_skill_old")
    private BigDecimal wSkillOld;

    @Column(name = "w_skill_new")
    private BigDecimal wSkillNew;

    @Column(name = "w_int_old")
    private BigDecimal wIntOld;

    @Column(name = "w_int_new")
    private BigDecimal wIntNew;

    @Column(name = "w_sacc_old")
    private BigDecimal wSaccOld;

    @Column(name = "w_sacc_new")
    private BigDecimal wSaccNew;

    @Column(name = "w_svol_old")
    private BigDecimal wSvolOld;

    @Column(name = "w_svol_new")
    private BigDecimal wSvolNew;

    @Column(name = "w_junior_old")
    private BigDecimal wJuniorOld;

    @Column(name = "w_junior_new")
    private BigDecimal wJuniorNew;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", nullable = false)
    private UserAccount changedBy;

    @Column(name = "changed_at", nullable = false)
    @Builder.Default
    private LocalDateTime changedAt = LocalDateTime.now();

    @Column(columnDefinition = "TEXT")
    private String note;
}
