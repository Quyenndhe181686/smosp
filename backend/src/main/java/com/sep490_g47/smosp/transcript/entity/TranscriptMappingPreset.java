package com.sep490_g47.smosp.transcript.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;


@Entity
@Table(name = "transcript_mapping_preset")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class TranscriptMappingPreset extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "preset_name", nullable = false, length = 100)
    private String presetName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_mapping", columnDefinition = "jsonb")
    private Map<String, String> columnMapping;

    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private Boolean isDefault = false;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = false;

    /**
     * Soft-delete. UC-108 Postconditions đòi bảo toàn lịch sử parse; và
     * {@code Transcript.preset_id} là FK thật không có {@code @OnDelete} — hard
     * delete một preset đang được Transcript cũ tham chiếu sẽ ném lỗi vi phạm
     * khoá ngoại thô ở tầng DB thay vì lỗi nghiệp vụ sạch.
     */
    @Column(name = "is_deleted", nullable = false, columnDefinition = "boolean DEFAULT false")
    @Builder.Default
    private Boolean isDeleted = false;

}

