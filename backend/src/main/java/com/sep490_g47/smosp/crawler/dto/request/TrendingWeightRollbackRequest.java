package com.sep490_g47.smosp.crawler.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class TrendingWeightRollbackRequest {
    @NotNull
    private UUID narrowSpecId;
    
    @NotNull
    private Integer targetVersion;
}
