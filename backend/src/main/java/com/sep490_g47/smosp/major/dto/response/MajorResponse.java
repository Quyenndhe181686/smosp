package com.sep490_g47.smosp.major.dto.response;

import lombok.Data;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@SuperBuilder
public class MajorResponse extends BaseResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private String imageUrl;
    private BigDecimal tuitionPerTerm;
    private BigDecimal pricePerCredit;
    private LocalDateTime tuitionUpdatedAt;
    private Boolean isActive;
}
