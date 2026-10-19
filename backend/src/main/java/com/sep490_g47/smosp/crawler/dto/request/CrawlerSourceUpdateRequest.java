package com.sep490_g47.smosp.crawler.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CrawlerSourceUpdateRequest {
    @NotBlank(message = "Tên nguồn không được để trống")
    private String name;
    
    private String scheduleCron;
}
