package com.sep490_g47.smosp.roadmap.dto.request;
import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Data
public class UpdateProgressRequest {
    // Whitelist dung; khong chi @NotBlank. Truoc day gui "in_progress" chu thuong
    // van qua duoc @NotBlank, roi o service STATUSES_REQUIRING_PREREQ_CHECK.contains()
    // so khop chinh xac hoa/thuong nen bo qua het cong kiem tien quyet.
    @NotBlank
    @Pattern(regexp = "PLANNED|IN_PROGRESS|COMPLETED",
            message = "status phai la PLANNED, IN_PROGRESS hoac COMPLETED")
    private String status;
}
