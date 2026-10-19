package com.sep490_g47.smosp.narrowspec.dto.request;

import com.sep490_g47.smosp.narrowspec.util.NarrowSpecConstants;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class NarrowSpecRequest {
    @NotNull(message = NarrowSpecConstants.VALIDATION_SPEC_ID_REQUIRED)
    private UUID specializationId;

    @NotBlank(message = NarrowSpecConstants.VALIDATION_CODE_REQUIRED)
    private String code;

    @NotBlank(message = NarrowSpecConstants.VALIDATION_NAME_REQUIRED)
    private String name;

    private String description;
}
