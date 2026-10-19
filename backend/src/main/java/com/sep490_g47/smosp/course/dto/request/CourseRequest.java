package com.sep490_g47.smosp.course.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class CourseRequest {
    @NotBlank(message = "Code is required")
    @Size(max = 20, message = "Mã môn học không vượt quá 20 ký tự (BV-21)")
    @Pattern(regexp = "^[a-zA-Z0-9]+$", message = "Mã môn học chỉ bao gồm chữ và số (BV-21)")
    private String code;

    @NotBlank(message = "Name is required")
    private String name;

    @NotNull(message = "Credits are required")
    @Min(value = 1, message = "Số tín chỉ phải lớn hơn hoặc bằng 1 (BV-20)")
    @Max(value = 10, message = "Số tín chỉ phải nhỏ hơn hoặc bằng 10 (BV-20)")
    private Integer credits;

    private String description;
    private Boolean countsTowardGpa;
    private Boolean isActive;
}
