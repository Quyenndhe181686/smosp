package com.sep490_g47.smosp.roadmap.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalRoadmapResourceResponse {

    private UUID id;
    private UUID courseId;
    private String title;
    private String url;
    private String publicId;
    private String resourceType;
    private Long fileSize;
    private String fileName;
    private LocalDateTime createdAt;
}
