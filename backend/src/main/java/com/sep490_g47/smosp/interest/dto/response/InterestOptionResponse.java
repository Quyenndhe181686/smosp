package com.sep490_g47.smosp.interest.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class InterestOptionResponse extends BaseResponse {
    private UUID id;
    private UUID specializationId;
    private String label;
    private Boolean isActive;
}
