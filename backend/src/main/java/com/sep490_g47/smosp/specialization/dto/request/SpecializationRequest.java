package com.sep490_g47.smosp.specialization.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

import jakarta.validation.constraints.Size;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpecializationRequest {

    @NotNull(message = "Major ID is required")
    private UUID majorId;

    @NotBlank(message = "Code is required")
    @Size(max = 50, message = "Mã Specialization không vượt quá 50 ký tự (BV-15)")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Tên Specialization không vượt quá 100 ký tự (BV-15)")
    private String name;

    @Size(max = 500, message = "Mô tả Specialization không vượt quá 500 ký tự (BV-15)")
    private String description;

}
