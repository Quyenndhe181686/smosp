package com.sep490_g47.smosp.catalog.dto.response;

import com.sep490_g47.smosp.narrowspec.dto.response.NsCourseResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NarrowSpecDetailResponse {
    private UUID id;
    private UUID specializationId;
    private String code;
    private String name;
    private String description;
    private Boolean isPublished;
    private LocalDateTime publishedAt;
    private List<NsCourseResponse> courses;
}
