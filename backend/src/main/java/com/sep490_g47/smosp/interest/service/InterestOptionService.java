package com.sep490_g47.smosp.interest.service;

import com.sep490_g47.smosp.interest.dto.request.InterestOptionRequest;
import com.sep490_g47.smosp.interest.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.interest.dto.response.InterestOptionResponse;

import java.util.List;
import java.util.UUID;

public interface InterestOptionService {
    List<InterestOptionResponse> getSpecializationInterests(UUID specializationId);
    InterestOptionResponse createInterestOption(InterestOptionRequest request);
    InterestOptionResponse updateInterestOption(UUID id, InterestOptionRequest request);
    InterestOptionResponse updateStatus(UUID id, StatusUpdateRequest request);
}
