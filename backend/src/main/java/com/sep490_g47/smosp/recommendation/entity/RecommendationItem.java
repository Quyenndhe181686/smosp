package com.sep490_g47.smosp.recommendation.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "recommendation_item", indexes = {
        @Index(name = "idx_recommendation_item_result_id", columnList = "result_id"),
        @Index(name = "idx_recommendation_item_result_rank", columnList = "result_id, rank")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecommendationItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_id", nullable = false)
    private RecommendationResult result;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "narrow_spec_id", nullable = false)
    private NarrowSpecialization narrowSpec;

    @Column(name = "gpa_score", precision = 5, scale = 2, nullable = false)
    private BigDecimal gpaScore;

    @Column(name = "skill_score", precision = 5, scale = 2, nullable = false)
    private BigDecimal skillScore;

    @Column(name = "interest_score", precision = 5, scale = 2, nullable = false)
    private BigDecimal interestScore;

    @Column(name = "w_gpa_snapshot", precision = 4, scale = 3, nullable = false)
    private BigDecimal wGpaSnapshot;

    @Column(name = "w_skill_snapshot", precision = 4, scale = 3, nullable = false)
    private BigDecimal wSkillSnapshot;

    @Column(name = "w_int_snapshot", precision = 4, scale = 3, nullable = false)
    private BigDecimal wIntSnapshot;

    @Column(name = "profile_score", precision = 6, scale = 3, nullable = false)
    private BigDecimal profileScore;

    @Column(name = "trending_weight_snapshot", precision = 6, scale = 3)
    private BigDecimal trendingWeightSnapshot;

    @Column(name = "alpha_actual", precision = 4, scale = 3, nullable = false)
    private BigDecimal alphaActual;

    @Column(name = "final_score", precision = 6, scale = 3, nullable = false)
    private BigDecimal finalScore;

    @Column(name = "rank", nullable = false)
    private Integer rank;

    @Column(name = "fallback_applied", nullable = false)
    @Builder.Default
    private Boolean fallbackApplied = false;

    @Column(name = "ai_explanation", columnDefinition = "TEXT")
    private String aiExplanation;

    @Column(name = "explanation_cached", nullable = false)
    @Builder.Default
    private Boolean explanationCached = false;

    @Column(name = "skill_gaps_snapshot", columnDefinition = "TEXT")
    private String skillGapsSnapshot;

    @Column(name = "interest_gaps_snapshot", columnDefinition = "TEXT")
    private String interestGapsSnapshot;

    @Column(name = "suggested_courses_snapshot", columnDefinition = "TEXT")
    private String suggestedCoursesSnapshot;
}
