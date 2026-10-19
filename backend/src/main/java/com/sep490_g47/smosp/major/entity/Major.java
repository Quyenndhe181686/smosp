package com.sep490_g47.smosp.major.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;
import java.math.BigDecimal;

@Entity
@Table(name = "major")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Major extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "tuition_per_term", precision = 15, scale = 2)
    private BigDecimal tuitionPerTerm;

    @Column(name = "price_per_credit", precision = 15, scale = 2)
    private BigDecimal pricePerCredit;

    @Column(name = "tuition_updated_at")
    private LocalDateTime tuitionUpdatedAt;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

}
