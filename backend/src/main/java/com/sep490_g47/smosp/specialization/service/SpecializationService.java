package com.sep490_g47.smosp.specialization.service;

import com.sep490_g47.smosp.specialization.dto.request.SpecCourseRequest;
import com.sep490_g47.smosp.specialization.dto.response.SpecCourseResponse;
import com.sep490_g47.smosp.specialization.dto.request.SpecializationRequest;
import com.sep490_g47.smosp.specialization.dto.response.SpecializationResponse;
import com.sep490_g47.smosp.specialization.dto.request.StatusUpdateRequest;

import java.util.List;
import java.util.UUID;

public interface SpecializationService {
    SpecializationResponse createSpecialization(SpecializationRequest request);
    SpecializationResponse updateSpecialization(UUID id, SpecializationRequest request);
    SpecializationResponse updateStatus(UUID id, StatusUpdateRequest request);
    
    List<SpecCourseResponse> getSpecializationCourses(UUID specializationId);
    List<SpecCourseResponse> updateSpecializationCourses(UUID specializationId, List<SpecCourseRequest> requests);
}
