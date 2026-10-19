package com.sep490_g47.smosp.student.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentProfileResponse {
    private UUID id;
    private String fullName;
    private String studentCode;
    private UUID majorId;
    private String majorName;
    private UUID specializationId;
    private String specializationName;
    private UUID currentNarrowSpecId;
    private String currentNarrowSpecName;
    private Integer currentTerm;
    private BigDecimal cumulativeGpa;
    private LocalDateTime profileUpdatedAt;
}
