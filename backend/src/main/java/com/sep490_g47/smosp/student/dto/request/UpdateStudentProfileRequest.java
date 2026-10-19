package com.sep490_g47.smosp.student.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateStudentProfileRequest {
    
    @NotBlank(message = "Full name is mandatory")
    private String fullName;
    
    private String studentCode;
    
    @NotNull(message = "Major ID is mandatory")
    private UUID majorId;
    
    @NotNull(message = "Specialization ID is mandatory")
    private UUID specializationId;
    
    @NotNull(message = "Current term is mandatory")
    @Min(value = 1, message = "Current term must be at least 1")
    @Max(value = 9, message = "Current term must be at most 9")
    private Integer currentTerm;

    private UUID currentNarrowSpecId;
}
