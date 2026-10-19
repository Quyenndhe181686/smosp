package com.sep490_g47.smosp.specialization.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SpecializationResponse extends BaseResponse {

    private UUID id;
    private UUID majorId;
    private String code;
    private String name;
    private String description;
    private String imageUrl;
    private BigDecimal alphaBase;
    private Boolean isActive;

}
