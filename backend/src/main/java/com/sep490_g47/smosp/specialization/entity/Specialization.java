package com.sep490_g47.smosp.specialization.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.major.entity.Major;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "specialization")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Specialization extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "major_id", nullable = false)
    private Major major;

    @Column(unique = true, nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "alpha_base", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal alphaBase = new BigDecimal("0.70");

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "vietnamworks_category_ids", columnDefinition = "TEXT")
    private String vietnamworksCategoryIds;

}
