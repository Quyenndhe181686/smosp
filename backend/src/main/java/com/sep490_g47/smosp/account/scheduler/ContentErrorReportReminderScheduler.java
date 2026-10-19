package com.sep490_g47.smosp.account.scheduler;

import com.sep490_g47.smosp.account.service.ContentErrorReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nhắc hạn xử lý report lỗi nội dung — report PENDING chưa CM nào claim, hoặc
 * report IN_PROGRESS đã claim nhưng đứng im quá lâu, đều không có tín hiệu nào
 * trước đây. Chạy 1 lần/ngày, logic thật nằm ở
 * {@link ContentErrorReportService#remindOverdueReports()}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ContentErrorReportReminderScheduler {

    private final ContentErrorReportService reportService;

    @Value("${smosp.content-error-report.reminder.enabled:true}")
    private boolean reminderEnabled;

    @Scheduled(cron = "${smosp.content-error-report.reminder.cron:0 0 8 * * *}")
    public void remindOverdueReports() {
        if (!reminderEnabled) {
            log.info("[ContentErrorReportReminderScheduler] Reminder scheduler is disabled via configuration.");
            return;
        }

        log.info("[ContentErrorReportReminderScheduler] Scanning for overdue content error reports...");
        try {
            int sent = reportService.remindOverdueReports();
            log.info("[ContentErrorReportReminderScheduler] Done. Notifications sent: {}", sent);
        } catch (Exception e) {
            log.error("[ContentErrorReportReminderScheduler] Error occurred while sending overdue report reminders", e);
        }
    }
}
