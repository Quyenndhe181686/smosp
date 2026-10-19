package com.sep490_g47.smosp.narrowspec.service;

import com.sep490_g47.smosp.narrowspec.dto.request.WeightConfigUpdateRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.WeightConfigAuditResponse;
import com.sep490_g47.smosp.narrowspec.dto.response.WeightConfigResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface NarrowSpecWeightConfigService {
    WeightConfigResponse getWeightConfig(UUID narrowSpecId);
    WeightConfigResponse updateWeightConfig(UUID narrowSpecId, WeightConfigUpdateRequest request);
    Page<WeightConfigAuditResponse> getWeightConfigAudit(UUID narrowSpecId, Pageable pageable);
}
