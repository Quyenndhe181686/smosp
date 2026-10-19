package com.sep490_g47.smosp.curriculum.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CurriculumRequest {
    @NotNull(message = "Specialization ID is required")
    private UUID specializationId;

    private Integer externalCurId;

    @NotBlank(message = "Curriculum code is required")
    private String curriculumCode;

    private String batchCode;
    private String curriculumNameVi;
    private String curriculumNameEn;
    private String decisionNo;
    private LocalDate decisionDate;
    private String description;
}
