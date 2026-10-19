package com.sep490_g47.smosp.admin.service;

import com.sep490_g47.smosp.admin.dto.request.SystemConfigUpdateRequest;
import com.sep490_g47.smosp.admin.dto.response.AiUsageStatsResponse;
import com.sep490_g47.smosp.admin.dto.response.SystemConfigResponse;
import com.sep490_g47.smosp.admin.dto.response.SystemStatsResponse;

import java.util.List;

public interface AdminSystemConfigService {
    List<SystemConfigResponse> getAllConfigs();
    void updateConfigs(SystemConfigUpdateRequest request);
    AiUsageStatsResponse getAiUsageStats();
    SystemStatsResponse getSystemStats();
}
