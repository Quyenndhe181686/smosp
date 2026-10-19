package com.sep490_g47.smosp.curriculum.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "curriculum")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Curriculum extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialization_id", nullable = false)
    private Specialization specialization;

    @Column(name = "external_cur_id")
    private Integer externalCurId;

    @Column(name = "curriculum_code", nullable = false, unique = true, length = 100)
    private String curriculumCode;

    @Column(name = "batch_code", length = 50)
    private String batchCode;

    @Column(name = "curriculum_name_vi", columnDefinition = "TEXT")
    private String curriculumNameVi;

    @Column(name = "curriculum_name_en", columnDefinition = "TEXT")
    private String curriculumNameEn;

    @Column(name = "decision_no", length = 100)
    private String decisionNo;

    @Column(name = "decision_date")
    private LocalDate decisionDate;

    @Column(columnDefinition = "TEXT")
    private String description;

}
