package com.sep490_g47.smosp.curriculum.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class CurriculumResponse extends BaseResponse {
    private UUID id;
    private UUID specializationId;
    private String specializationCode;
    private String specializationName;
    private Integer externalCurId;
    private String curriculumCode;
    private String batchCode;
    private String curriculumNameVi;
    private String curriculumNameEn;
    private String decisionNo;
    private LocalDate decisionDate;
    private String description;
}
