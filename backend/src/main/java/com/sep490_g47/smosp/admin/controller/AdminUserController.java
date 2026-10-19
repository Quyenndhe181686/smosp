package com.sep490_g47.smosp.admin.controller;

import com.sep490_g47.smosp.admin.dto.request.CreateStaffRequest;
import com.sep490_g47.smosp.admin.dto.request.ResetPasswordRequest;
import com.sep490_g47.smosp.admin.dto.request.UpdateStatusRequest;
import com.sep490_g47.smosp.admin.dto.response.UserListItemResponse;
import com.sep490_g47.smosp.admin.dto.response.UserStatsResponse;
import com.sep490_g47.smosp.admin.service.AdminUserService;
import com.sep490_g47.smosp.auth.dto.response.MessageResponse;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping("/users")
    public ResponseEntity<Page<UserListItemResponse>> getUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(adminUserService.getUsers(keyword, role, status, page, size));
    }

    /** Số liệu tổng hợp theo vai trò cho phần thống kê đầu trang danh sách tài khoản. */
    @GetMapping("/users/stats")
    public ResponseEntity<UserStatsResponse> getUserStats(@RequestParam String role) {
        return ResponseEntity.ok(adminUserService.getUserStats(role));
    }

    @PatchMapping("/users/{id}/status")
    public ResponseEntity<MessageResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(adminUserService.updateStatus(id, request.getStatus(), userDetails.getUserId()));
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(
            @PathVariable UUID id,
            @Valid @RequestBody ResetPasswordRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(adminUserService.resetPassword(id, request.getNewPassword(), userDetails.getUserId()));
    }

    @PostMapping("/staff")
    public ResponseEntity<UserListItemResponse> createStaff(
            @Valid @RequestBody CreateStaffRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(adminUserService.createStaff(request, userDetails.getUserId()));
    }
}
