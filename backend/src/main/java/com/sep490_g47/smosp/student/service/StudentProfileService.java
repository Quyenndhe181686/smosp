package com.sep490_g47.smosp.student.service;

import com.sep490_g47.smosp.student.dto.response.StudentProfileResponse;
import com.sep490_g47.smosp.student.dto.request.UpdateStudentProfileRequest;

import java.util.UUID;

public interface StudentProfileService {
    StudentProfileResponse getMyProfile(UUID userId);
    StudentProfileResponse updateMyProfile(UUID userId, UpdateStudentProfileRequest request);
}
