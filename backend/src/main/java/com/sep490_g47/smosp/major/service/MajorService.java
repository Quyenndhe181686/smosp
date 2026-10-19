package com.sep490_g47.smosp.major.service;

import com.sep490_g47.smosp.major.dto.request.MajorRequest;
import com.sep490_g47.smosp.major.dto.response.MajorResponse;
import com.sep490_g47.smosp.major.dto.request.StatusUpdateRequest;

import java.util.UUID;

public interface MajorService {
    MajorResponse createMajor(MajorRequest request);
    MajorResponse updateMajor(UUID id, MajorRequest request);
    MajorResponse updateMajorStatus(UUID id, StatusUpdateRequest request);
    java.util.List<MajorResponse> getAllMajors();
}
