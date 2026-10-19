package com.sep490_g47.smosp.admin.service;

import com.sep490_g47.smosp.admin.dto.request.CreateStaffRequest;
import com.sep490_g47.smosp.admin.dto.response.UserListItemResponse;
import com.sep490_g47.smosp.admin.dto.response.UserStatsResponse;
import com.sep490_g47.smosp.auth.dto.response.MessageResponse;
import org.springframework.data.domain.Page;

import java.util.UUID;

public interface AdminUserService {
    Page<UserListItemResponse> getUsers(String keyword, String role, String status, int page, int size);
    UserStatsResponse getUserStats(String role);
    MessageResponse updateStatus(UUID targetId, String newStatus, UUID adminId);
    MessageResponse resetPassword(UUID targetId, String newPassword, UUID adminId);
    UserListItemResponse createStaff(CreateStaffRequest request, UUID adminId);
}
