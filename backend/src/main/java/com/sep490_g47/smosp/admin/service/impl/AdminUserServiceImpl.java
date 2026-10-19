package com.sep490_g47.smosp.admin.service.impl;

import com.sep490_g47.smosp.account.entity.ContentErrorReport;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import com.sep490_g47.smosp.account.enums.UserAccountStatus;
import com.sep490_g47.smosp.account.repository.ContentErrorReportRepository;
import com.sep490_g47.smosp.admin.dto.request.CreateStaffRequest;
import com.sep490_g47.smosp.admin.dto.response.UserListItemResponse;
import com.sep490_g47.smosp.admin.dto.response.UserStatsResponse;
import com.sep490_g47.smosp.admin.service.AdminUserService;
import com.sep490_g47.smosp.auth.dto.response.MessageResponse;
import com.sep490_g47.smosp.auth.entity.Role;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.RefreshTokenRepository;
import com.sep490_g47.smosp.auth.repository.RoleRepository;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.transcript.entity.AdminActionLog;
import com.sep490_g47.smosp.transcript.repository.AdminActionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private final UserAccountRepository userAccountRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AdminActionLogRepository adminActionLogRepository;
    private final ContentErrorReportRepository contentErrorReportRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public Page<UserListItemResponse> getUsers(String keyword, String role, String status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        String safeKeyword = (keyword != null && !keyword.trim().isEmpty()) ? keyword.trim() : null;
        String safeRole = (role != null && !role.trim().isEmpty()) ? role.trim() : null;
        String safeStatus = (status != null && !status.trim().isEmpty()) ? status.trim() : null;
        Page<UserAccount> users = userAccountRepository.findAllForAdmin(safeKeyword, safeRole, safeStatus, pageable);
        return users.map(this::toUserListItemResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public UserStatsResponse getUserStats(String role) {
        long active = 0;
        long inactive = 0;
        for (Object[] row : userAccountRepository.countByStatusForRole(role)) {
            String status = (String) row[0];
            long count = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            if ("INACTIVE".equals(status)) {
                inactive += count;
            } else {
                active += count;
            }
        }

        LocalDateTime firstDayOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        return UserStatsResponse.builder()
                .role(role)
                .total(active + inactive)
                .active(active)
                .inactive(inactive)
                .newThisMonth(userAccountRepository.countCreatedSinceForRole(role, firstDayOfMonth))
                .build();
    }

    @Override
    @Transactional
    public MessageResponse updateStatus(UUID targetId, String newStatus, UUID adminId) {
        UserAccount user = userAccountRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if ("ROLE_SUPER_ADMIN".equals(user.getRole().getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thể thay đổi trạng thái super-admin");
        }

        if (UserAccountStatus.PENDING_VERIFICATION.name().equals(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể thay đổi trạng thái tài khoản đang chờ xác thực email");
        }

        if (!UserAccountStatus.ACTIVE.name().equals(newStatus) && !UserAccountStatus.INACTIVE.name().equals(newStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status phải là ACTIVE hoặc INACTIVE");
        }

        int releasedReports = 0;
        if (UserAccountStatus.INACTIVE.name().equals(newStatus)) {
            if ("ROLE_ADMIN".equals(user.getRole().getName()) && userAccountRepository.countActiveAdmins() <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phải giữ ít nhất 1 Admin active");
            }
            refreshTokenRepository.deleteAllByUserId(targetId);
            releasedReports = releaseClaimedReports(targetId);
        }

        user.setStatus(newStatus);
        userAccountRepository.save(user);

        UserAccount admin = userAccountRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        adminActionLogRepository.save(AdminActionLog.builder()
                .actor(admin)
                .action("UPDATE_USER_STATUS")
                .targetType("UserAccount")
                .targetId(targetId)
                .detail("status changed to " + newStatus
                        + (releasedReports > 0 ? "; released " + releasedReports + " claimed content error report(s)" : ""))
                .build());

        return new MessageResponse("User status updated to " + newStatus, true);
    }

    /**
     * CM bị deactivate mà đang giữ dở report lỗi nội dung thì report đó kẹt vĩnh
     * viễn: guard claim trong {@code ContentErrorReportServiceImpl.processReport()}
     * chặn mọi CM khác vì {@code assignedTo} vẫn trỏ tới người đã nghỉ, và không có
     * đường nào gỡ claim. Trả report về đúng trạng thái trước khi nhận (PENDING,
     * bỏ assignedTo/assignedAt) để CM khác nhận lại được.
     *
     * CHỈ đụng report còn IN_PROGRESS — RESOLVED/DISMISSED/CANCELLED/DELETED đều đã
     * kết thúc vòng đời, hồi sinh chúng mới là lỗi. Xoá luôn {@code processingNote}
     * của CM cũ để report không còn dấu vết nào của lượt nhận đã huỷ: CM nhận tiếp
     * theo thấy đúng một report chưa ai đụng vào, không phải đoán xem ghi chú đang
     * đọc là của mình hay của người đã nghỉ.
     *
     * Không gửi thông báo riêng ở đây: report quay về PENDING với {@code createdAt}
     * cũ nên job nhắc hạn (ContentErrorReportReminderScheduler) sẽ tự báo lại cho
     * toàn bộ CM ở lần chạy kế tiếp, đúng cơ chế dành cho report chưa ai nhận.
     */
    private int releaseClaimedReports(UUID userId) {
        List<ContentErrorReport> claimed =
                contentErrorReportRepository.findByAssignedToIdAndStatus(userId, ReportStatus.IN_PROGRESS);
        if (claimed.isEmpty()) {
            return 0;
        }
        for (ContentErrorReport report : claimed) {
            report.setStatus(ReportStatus.PENDING);
            report.setAssignedTo(null);
            report.setAssignedAt(null);
            report.setProcessingNote(null);
        }
        contentErrorReportRepository.saveAll(claimed);
        return claimed.size();
    }

    @Override
    @Transactional
    public MessageResponse resetPassword(UUID targetId, String newPassword, UUID adminId) {
        UserAccount user = userAccountRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Cùng guard với updateStatus() ở trên. Thiếu nó thì một ROLE_ADMIN thường
        // đặt được password mới cho SUPER_ADMIN rồi đăng nhập bằng chính password
        // đó — leo thẳng lên quyền cao nhất hệ thống. forceChangePassword=true
        // không cản được vì nó chỉ có hiệu lực ở lần đăng nhập kế tiếp CỦA NẠN NHÂN.
        // SUPER_ADMIN vốn đã tự khôi phục được qua AuthServiceImpl.forgotPassword()
        // (không giới hạn role), nên không cần Admin reset hộ.
        if ("ROLE_SUPER_ADMIN".equals(user.getRole().getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thể reset password super-admin");
        }

        if ("ROLE_STUDENT".equals(user.getRole().getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ reset password cho Staff");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setForceChangePassword(true);
        userAccountRepository.save(user);

        UserAccount admin = userAccountRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        adminActionLogRepository.save(AdminActionLog.builder()
                .actor(admin)
                .action("RESET_PASSWORD")
                .targetType("UserAccount")
                .targetId(targetId)
                .detail("Password reset by admin")
                .build());

        return new MessageResponse("Password reset successfully", true);
    }

    @Override
    @Transactional
    public UserListItemResponse createStaff(CreateStaffRequest request, UUID adminId) {
        if (userAccountRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username đã tồn tại");
        }

        Role cmRole = roleRepository.findByName("ROLE_CONTENT_MANAGER")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Role ROLE_CONTENT_MANAGER not initialized"));

        UserAccount user = UserAccount.builder()
                .username(request.getUsername())
                .displayName(request.getDisplayName())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .status("ACTIVE")
                .forceChangePassword(true)
                .role(cmRole)
                .build();
        userAccountRepository.save(user);

        UserAccount admin = userAccountRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        adminActionLogRepository.save(AdminActionLog.builder()
                .actor(admin)
                .action("CREATE_STAFF")
                .targetType("UserAccount")
                .targetId(user.getId())
                .detail("Created staff account: " + request.getUsername())
                .build());

        return toUserListItemResponse(user);
    }

    private UserListItemResponse toUserListItemResponse(UserAccount user) {
        String roleName = user.getRole().getName().replace("ROLE_", "");
        String identifier = "STUDENT".equals(roleName) ? user.getEmail() : user.getUsername();
        return UserListItemResponse.builder()
                .id(user.getId())
                .identifier(identifier)
                .displayName(user.getDisplayName())
                .role(roleName)
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .forceChangePassword(user.isForceChangePassword())
                .build();
    }
}
