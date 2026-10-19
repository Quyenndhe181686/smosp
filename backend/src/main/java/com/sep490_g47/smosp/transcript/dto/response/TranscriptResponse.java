package com.sep490_g47.smosp.transcript.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TranscriptResponse extends BaseResponse {
    private UUID id;
    private String fileName;
    private LocalDateTime uploadTime;
    private Integer totalCredits;
    private Integer completedCourses;
    private BigDecimal cumulativeGpa;
    private List<StudentCourseGradeResponse> grades;
}
