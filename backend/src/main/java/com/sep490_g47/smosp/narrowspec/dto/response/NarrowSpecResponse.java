package com.sep490_g47.smosp.narrowspec.dto.response;

import lombok.Data;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@SuperBuilder
public class NarrowSpecResponse extends BaseResponse {
    private UUID id;
    private UUID specializationId;
    private String code;
    private String name;
    private String description;
    private Boolean isPublished;
    private LocalDateTime publishedAt;
}
