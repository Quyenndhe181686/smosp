package com.sep490_g47.smosp.account.scheduler;

import com.sep490_g47.smosp.account.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler tự động phát thông báo định kỳ vào ngày 15/1, 15/5 và 15/9 hằng năm
 * để nhắc nhở tất cả sinh viên (ROLE_STUDENT) cập nhật bảng điểm từ FAP và
 * điều chỉnh lộ trình học tập cá nhân trên hệ thống SMOSP.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PeriodicReminderScheduler {

    private final NotificationService notificationService;

    @Value("${smosp.notification.reminder.enabled:true}")
    private boolean reminderEnabled;

    /**
     * Chạy định kỳ vào 08:00 AM các ngày 15/1, 15/5, 15/9 hằng năm.
     * Cron expression: "0 0 8 15 1,5,9 *"
     */
    @Scheduled(cron = "${smosp.notification.reminder.cron:0 52 1 11 8,5,9 *}")
    public void schedulePeriodicReminder() {
        if (!reminderEnabled) {
            log.info("[PeriodicReminderScheduler] Reminder scheduler is disabled via configuration.");
            return;
        }

        log.info("[PeriodicReminderScheduler] Triggering periodic transcript & roadmap update notification broadcast...");
        try {
            int count = notificationService.broadcastPeriodicReminder();
            log.info("[PeriodicReminderScheduler] Broadcast finished. Total notifications sent: {}", count);
        } catch (Exception e) {
            log.error("[PeriodicReminderScheduler] Error occurred while sending periodic reminder notifications", e);
        }
    }
}
