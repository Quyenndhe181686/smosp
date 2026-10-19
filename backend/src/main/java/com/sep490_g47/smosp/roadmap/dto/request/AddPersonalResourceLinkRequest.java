package com.sep490_g47.smosp.roadmap.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddPersonalResourceLinkRequest {

    @NotBlank(message = "Tên tài nguyên không được để trống")
    private String title;

    @NotBlank(message = "Đường dẫn không được để trống")
    private String url;

    private String resourceType = "LINK";
}
