package com.sep490_g47.smosp.major.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.math.BigDecimal;

import jakarta.validation.constraints.Size;

@Data
public class MajorRequest {
    @NotBlank(message = "Code is required")
    @Size(max = 50, message = "Mã Major không vượt quá 50 ký tự (BV-15)")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Tên Major không vượt quá 100 ký tự (BV-15)")
    private String name;

    @Size(max = 500, message = "Mô tả Major không vượt quá 500 ký tự (BV-15)")
    private String description;

    @DecimalMin(value = "0", message = "Học phí mỗi kỳ không được âm")
    private BigDecimal tuitionPerTerm;

    @DecimalMin(value = "0", message = "Giá mỗi tín chỉ không được âm")
    private BigDecimal pricePerCredit;
}
