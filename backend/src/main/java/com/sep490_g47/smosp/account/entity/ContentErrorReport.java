package com.sep490_g47.smosp.account.entity;

import com.sep490_g47.smosp.account.enums.ReportEntityType;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "content_error_report")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ContentErrorReport extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    private UserAccount reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 50)
    private ReportEntityType entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    /**
     * Tên và mã của nội dung bị báo lỗi, chốt lại NGAY LÚC TẠO báo cáo.
     *
     * Lưu thẳng vào đây thay vì join ra lúc đọc vì hai lý do: danh sách của
     * Content Manager trả về hàng trăm báo cáo một lượt, tra từng cái sẽ thành
     * N+1 query; và báo cáo phải phản ánh thứ sinh viên NHÌN THẤY lúc báo — nội
     * dung sau đó bị đổi tên thì báo cáo cũ vẫn phải đọc được đúng ngữ cảnh.
     */
    @Column(name = "entity_name", length = 255)
    private String entityName;

    @Column(name = "entity_code", length = 50)
    private String entityCode;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;


    @Column(name = "processing_note", columnDefinition = "TEXT")
    private String processingNote;

    @Column(name = "deleted_reason", columnDefinition = "TEXT")
    private String deletedReason;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    /**
     * L2_INT_TEST_LAYER1_DEF_04-follow-up — CM "claim" report khi gọi processReport()
     * lần đầu. Trước đây không có trường này nên CM khác vẫn PATCH được report đã
     * có người xử lý, ghi đè âm thầm lẫn nhau.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private UserAccount assignedTo;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;
}
