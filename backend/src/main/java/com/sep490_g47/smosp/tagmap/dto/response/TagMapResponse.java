package com.sep490_g47.smosp.tagmap.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class TagMapResponse extends BaseResponse {
    private UUID id;
    private String sourceType;
    private UUID sourceId;
    private String sourceName;
    private String mappingType;
    private BigDecimal weight;
}
