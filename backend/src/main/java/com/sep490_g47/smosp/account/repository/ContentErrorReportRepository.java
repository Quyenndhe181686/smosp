package com.sep490_g47.smosp.account.repository;

import com.sep490_g47.smosp.account.entity.ContentErrorReport;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ContentErrorReportRepository extends JpaRepository<ContentErrorReport, UUID> {
    List<ContentErrorReport> findByReporterIdAndStatusNotOrderByCreatedAtDesc(UUID reporterId, ReportStatus status);
    List<ContentErrorReport> findByStatusOrderByCreatedAtDesc(ReportStatus status);
    List<ContentErrorReport> findByStatusNotOrderByCreatedAtDesc(ReportStatus status);

    long countByStatusIn(List<ReportStatus> statuses);

    /** Report vẫn PENDING (chưa ai claim) quá lâu — dùng cho job nhắc hạn. */
    List<ContentErrorReport> findByStatusAndCreatedAtBefore(ReportStatus status, LocalDateTime before);

    /** Report đã claim (IN_PROGRESS) nhưng đứng im quá lâu — dùng cho job nhắc hạn. */
    List<ContentErrorReport> findByStatusAndAssignedAtBefore(ReportStatus status, LocalDateTime before);

    /** Report một CM đang giữ dở — dùng khi CM đó bị deactivate, phải trả report về hàng chờ. */
    List<ContentErrorReport> findByAssignedToIdAndStatus(UUID assignedToId, ReportStatus status);
}
