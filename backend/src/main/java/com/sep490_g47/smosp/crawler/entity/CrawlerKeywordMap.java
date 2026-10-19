package com.sep490_g47.smosp.crawler.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(
    name = "crawler_keyword_map",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"narrow_spec_id", "keyword"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CrawlerKeywordMap extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "narrow_spec_id", nullable = false)
    private NarrowSpecialization narrowSpec;

    @Column(name = "keyword", nullable = false)
    private String keyword;

    @Column(name = "is_active", nullable = false, columnDefinition = "boolean DEFAULT true")
    @Builder.Default
    private boolean active = true;

    @Column(name = "tier", nullable = false, length = 20)
    @Builder.Default
    private String tier = "CORE_BASE";

    @Column(name = "score", nullable = false)
    @Builder.Default
    private Integer score = 3;
}
