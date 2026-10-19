package com.sep490_g47.smosp.admin.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_api_usage_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiApiUsageLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "purpose", nullable = false)
    private String purpose;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "token_count", nullable = false, columnDefinition = "int DEFAULT 0")
    @Builder.Default
    private int tokenCount = 0;

    @Column(name = "called_at", nullable = false)
    private LocalDateTime calledAt;
}
