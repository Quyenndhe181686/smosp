package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
    name = "job_normalized",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"raw_id", "narrow_spec_id"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobNormalized extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "raw_id", nullable = false)
    private RawJob rawJob;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "narrow_spec_id")
    private NarrowSpecialization narrowSpec;

    private String title;

    @Column(name = "job_level")
    private String jobLevel;

    @Column(name = "salary_range")
    private String salaryRange;

    @Column(name = "is_junior", nullable = false, columnDefinition = "boolean DEFAULT false")
    @Builder.Default
    private boolean junior = false;

    @Column(name = "posted_date")
    private LocalDate postedDate;
}
