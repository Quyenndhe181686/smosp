package com.sep490_g47.smosp.common.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Data
@SuperBuilder
@NoArgsConstructor
public abstract class BaseResponse {
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
