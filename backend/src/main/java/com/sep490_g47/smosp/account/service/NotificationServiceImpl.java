package com.sep490_g47.smosp.account.service;

import com.sep490_g47.smosp.account.dto.response.NotificationResponse;
import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserAccountRepository userAccountRepository;

    @Override
    public List<NotificationResponse> getNotifications(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void markAsRead(UUID userId, UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));

        if (!notification.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to modify this notification");
        }

        notification.setIsRead(true);
        notificationRepository.save(notification);
    }

    @Override
    @Transactional
    public void markAllAsRead(UUID userId) {
        List<Notification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalse(userId);
        unreadNotifications.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unreadNotifications);
    }

    @Override
    @Transactional
    public int broadcastPeriodicReminder() {
        List<UserAccount> activeStudents = userAccountRepository.findByRole_NameAndStatus("ROLE_STUDENT", "ACTIVE");
        if (activeStudents.isEmpty()) {
            log.info("[PeriodicReminder] No active student accounts found to send reminder.");
            return 0;
        }

        String title = "[Nhắc nhở định kỳ] Cập nhật bảng điểm & Lộ trình học tập cá nhân";
        String body = "Đã đến đợt cập nhật định kỳ (ngày 15/1, 15/5, 15/9)! Hãy đồng bộ bảng điểm mới nhất từ FAP và kiểm tra lộ trình học tập cá nhân của bạn trên SMOSP để nhận các gợi ý chuyên ngành hẹp tối ưu nhất.";
        Map<String, Object> metadata = Map.of(
                "target", "/student/roadmap",
                "action", "SYNC_TRANSCRIPT_AND_ROADMAP",
                "scheduleDates", "8/11, 15/5, 15/9"
        );

        List<Notification> notifications = activeStudents.stream()
                .map(student -> Notification.builder()
                        .user(student)
                        .type("PERIODIC_ROADMAP_UPDATE")
                        .title(title)
                        .body(body)
                        .metadata(metadata)
                        .isRead(false)
                        .build())
                .collect(Collectors.toList());

        notificationRepository.saveAll(notifications);
        log.info("[PeriodicReminder] Successfully sent periodic reminder to {} active students.", notifications.size());
        return notifications.size();
    }

    private NotificationResponse mapToResponse(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .type(notification.getType())
                .title(notification.getTitle())
                .body(notification.getBody())
                .metadata(notification.getMetadata())
                .isRead(notification.getIsRead())
                .createdAt(notification.getCreatedAt())
                .updatedAt(notification.getUpdatedAt())
                .build();
    }
}
