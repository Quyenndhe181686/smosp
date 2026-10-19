package com.sep490_g47.smosp.account.service;

import com.sep490_g47.smosp.account.dto.request.ContentErrorReportRequest;
import com.sep490_g47.smosp.account.dto.response.ErrorReportResponse;
import com.sep490_g47.smosp.account.dto.request.UpdateContentErrorReportRequest;
import com.sep490_g47.smosp.account.entity.ContentErrorReport;
import com.sep490_g47.smosp.account.enums.ReportEntityType;
import com.sep490_g47.smosp.account.enums.ReportStatus;
import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.ContentErrorReportRepository;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.course.repository.LearningResourceRepository;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.roadmap.repository.PersonalRoadmapRepository;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContentErrorReportServiceImpl implements ContentErrorReportService {

    /** Nhãn tiếng Việt của từng loại nội dung, dùng trong nội dung thông báo. */
    private static final Map<ReportEntityType, String> ENTITY_TYPE_LABELS = Map.of(
            ReportEntityType.COURSE, "Môn học",
            ReportEntityType.RESOURCE, "Học liệu",
            ReportEntityType.NARROW_SPEC, "Chuyên ngành hẹp",
            ReportEntityType.SPECIALIZATION, "Chuyên ngành",
            ReportEntityType.MAJOR, "Ngành học",
            ReportEntityType.ROADMAP, "Lộ trình học tập");

    /** Report PENDING (chưa CM nào claim) quá 2 ngày → nhắc lại toàn bộ CM ACTIVE. */
    private static final int PENDING_UNCLAIMED_SLA_DAYS = 2;
    /** Report IN_PROGRESS (đã claim) đứng im quá 3 ngày → nhắc riêng CM đang giữ. */
    private static final int IN_PROGRESS_STUCK_SLA_DAYS = 3;

    private final ContentErrorReportRepository repository;
    private final UserAccountRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final CourseRepository courseRepository;
    private final LearningResourceRepository learningResourceRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final SpecializationRepository specializationRepository;
    private final MajorRepository majorRepository;
    private final PersonalRoadmapRepository personalRoadmapRepository;

    @Override
    @Transactional
    public ErrorReportResponse createReport(UUID reporterId, ContentErrorReportRequest request) {
        UserAccount reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Chốt tên nội dung ngay tại đây. Đồng thời đây là chỗ DUY NHẤT chặn được
        // báo cáo trỏ vào entityId không tồn tại: trước đây createReport() lưu
        // thẳng cặp entityType/entityId client gửi lên mà không kiểm gì, nên một
        // UUID bịa (hoặc lệch loại — id của Môn học gửi kèm entityType=MAJOR) vẫn
        // tạo được báo cáo, và Content Manager nhận về một báo cáo không tra ra
        // được nội dung nào.
        EntityLabel label = resolveEntityLabel(request.getEntityType(), request.getEntityId());

        ContentErrorReport report = ContentErrorReport.builder()
                .reporter(reporter)
                .entityType(request.getEntityType())
                .entityId(request.getEntityId())
                .entityName(label.name())
                .entityCode(label.code())
                .description(request.getDescription())
                .status(ReportStatus.PENDING)
                .build();

        report = repository.save(report);

        notifyContentManagersOfNewReport(report);

        return mapToResponse(report);
    }

    /**
     * AC-09-01 — "the system records the report and sends it to Content Manager as
     * a notification". Vế ghi báo cáo vốn đã đúng; vế gửi thông báo trước đây chỉ
     * là một dòng TODO, nên CM chỉ biết có báo cáo mới nếu tự vào danh sách xem.
     *
     * Gửi cho TẤT CẢ Content Manager đang hoạt động (quyết định nghiệp vụ
     * 2026-08-06). Hệ thống chưa có khái niệm phân công báo cáo theo người hay
     * theo khu vực, nên gửi cả nhóm là cách duy nhất bảo đảm không báo cáo nào rơi
     * vào khoảng trống. Khi nào có phân công thì thu hẹp lại ở đây.
     *
     * KHÔNG che danh tính người báo cáo trong notification: {@code metadata} chỉ
     * mang {@code reportId} và {@code entityType}, không mang reporterId — nhất
     * quán với BR-50 / GB-27 mà mapToResponse(report, true) đang giữ cho các
     * endpoint CM.
     */
    private void notifyContentManagersOfNewReport(ContentErrorReport report) {
        List<UserAccount> contentManagers =
                userRepository.findByRole_NameAndStatus("ROLE_CONTENT_MANAGER", "ACTIVE");
        if (contentManagers.isEmpty()) {
            // Không có CM nào đang hoạt động: báo cáo vẫn được lưu, nhưng phải để
            // lại dấu vết vì lúc đó không ai được báo và cũng không ai biết điều đó.
            log.warn("[AC-09-01] Khong co Content Manager ACTIVE nao — bao cao {} duoc luu nhung khong ai duoc thong bao",
                    report.getId());
            return;
        }

        // Nêu đích danh nội dung bị báo. Bản cũ chỉ ghi giá trị enum thô ("Một báo
        // cáo lỗi mới về COURSE") — CM đọc thông báo xong vẫn không biết môn nào,
        // phải mở danh sách dò lại từ đầu.
        String subject = describeEntity(report);
        for (UserAccount cm : contentManagers) {
            notificationRepository.save(Notification.builder()
                    .user(cm)
                    .type("CONTENT_ERROR_REPORT_CREATED")
                    .title("Có báo cáo lỗi nội dung mới")
                    .body("Báo cáo lỗi mới về " + subject + " đang chờ xử lý.")
                    .metadata(Map.of(
                            "reportId", report.getId().toString(),
                            "entityType", String.valueOf(report.getEntityType())))
                    .isRead(false)
                    .build());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ErrorReportResponse> getMyReports(UUID reporterId) {
        List<ContentErrorReport> reports = repository.findByReporterIdAndStatusNotOrderByCreatedAtDesc(reporterId, ReportStatus.DELETED);
        return reports.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ErrorReportResponse getReportById(UUID reporterId, UUID reportId) {
        ContentErrorReport report = getReportAndVerifyOwnership(reporterId, reportId);
        return mapToResponse(report);
    }

    @Override
    @Transactional
    public ErrorReportResponse updateReport(UUID reporterId, UUID reportId, UpdateContentErrorReportRequest request) {
        ContentErrorReport report = getReportAndVerifyOwnership(reporterId, reportId);

        if (report.getStatus() != ReportStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot update report that is not PENDING");
        }

        report.setDescription(request.getDescription());
        report = repository.save(report);

        return mapToResponse(report);
    }

    @Override
    @Transactional
    public void cancelReport(UUID reporterId, UUID reportId) {
        ContentErrorReport report = getReportAndVerifyOwnership(reporterId, reportId);

        if (report.getStatus() != ReportStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot cancel report that is not PENDING");
        }

        report.setStatus(ReportStatus.CANCELLED);
        repository.save(report);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ErrorReportResponse> getAllReports(ReportStatus status) {
        if (status == ReportStatus.DELETED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot query deleted reports");
        }

        List<ContentErrorReport> reports;
        if (status != null) {
            reports = repository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            reports = repository.findByStatusNotOrderByCreatedAtDesc(ReportStatus.DELETED);
        }
        return reports.stream().map(r -> mapToResponse(r, true)).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ErrorReportResponse getReportByIdForCm(UUID reportId) {
        ContentErrorReport report = repository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        
        if (report.getStatus() == ReportStatus.DELETED) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
        }

        return mapToResponse(report, true);
    }

    @Override
    @Transactional
    public ErrorReportResponse processReport(UUID reportId, com.sep490_g47.smosp.account.dto.request.ProcessReportRequest request, UUID actingCmId) {
        ContentErrorReport report = repository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));

        // Claim: CM dau tien goi processReport() tren report nay se "khoa" report
        // ve minh. Truoc day khong co buoc nay nen 2 CM bam gan nhu dong thoi se
        // ghi de am tham len nhau — khong loi, khong canh bao. Dat claim TRUOC khi
        // kiem trang thai/target o duoi, bat ke target la IN_PROGRESS, RESOLVED hay
        // DISMISSED (CM co the resolve thang khong can qua IN_PROGRESS truoc).
        if (report.getAssignedTo() == null) {
            report.setAssignedTo(userRepository.getReferenceById(actingCmId));
            report.setAssignedAt(LocalDateTime.now());
        } else if (!report.getAssignedTo().getId().equals(actingCmId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Report đang được xử lý bởi CM khác");
        }

        // Trước đây chỉ kiểm trạng thái ĐÍCH client gửi lên, không đọc trạng thái
        // NGUỒN của report trong DB — báo cáo đã DELETED (Admin xoá mềm) hoặc
        // CANCELLED (Student tự huỷ) vẫn chuyển được sang IN_PROGRESS/RESOLVED/
        // DISMISSED, "hồi sinh" một báo cáo lẽ ra đã kết thúc vòng đời. Nặng hơn vì
        // getAllReports() lọc DELETED khỏi danh sách CM — report CM không còn thấy
        // trên UI vẫn sửa được nếu biết id. Cùng convention với updateReport()/
        // cancelReport() ở trên: chỉ cho thao tác khi trạng thái nguồn còn hợp lệ.
        if (report.getStatus() == ReportStatus.DELETED || report.getStatus() == ReportStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot process a report that is " + report.getStatus());
        }

        if (request.getStatus() != ReportStatus.IN_PROGRESS &&
            request.getStatus() != ReportStatus.RESOLVED && 
            request.getStatus() != ReportStatus.DISMISSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be IN_PROGRESS, RESOLVED or DISMISSED");
        }

        if (request.getProcessingNote() == null || request.getProcessingNote().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Processing note cannot be blank");
        }

        report.setStatus(request.getStatus());
        report.setProcessingNote(request.getProcessingNote());
        report = repository.save(report);

        Notification notification = Notification.builder()
                .user(report.getReporter())
                .type("REPORT_STATUS_CHANGED")
                .title("Cập nhật trạng thái báo cáo")
                .body("Báo cáo của bạn về " + describeEntity(report) + " đã được chuyển sang trạng thái " + report.getStatus())
                .metadata(Map.of("reportId", report.getId().toString()))
                .isRead(false)
                .build();
        notificationRepository.save(notification);

        // BR-50 / GB-27: danh tính người báo cáo phải ẩn với CM suốt vòng đời báo
        // cáo. Đây là endpoint CM nên phải dùng overload maskIdentity=true, giống
        // getAllReports() và getReportByIdForCm(). Các chỗ gọi mapToResponse(report)
        // một tham số còn lại trong file đều là endpoint của chính sinh viên
        // (createReport, getMyReports, getReportById, updateReport) — ở đó reporterId
        // là của chính họ nên không che.
        return mapToResponse(report, true);
    }

    @Override
    @Transactional
    public void softDeleteReport(UUID reportId, com.sep490_g47.smosp.account.dto.request.DeleteReportRequest request, UUID adminId) {
        ContentErrorReport report = repository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));

        String reason = request.getDeletedReason();
        if (!reason.equals("SPAM") && !reason.equals("INVALID") && !reason.equals("DUPLICATE") && !reason.startsWith("OTHER: ")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deleted reason must be SPAM, INVALID, DUPLICATE, or start with 'OTHER: '");
        }

        report.setStatus(ReportStatus.DELETED);
        report.setDeletedReason(reason);
        report.setDeletedBy(adminId);
        repository.save(report);
    }

    /**
     * Job nhắc hạn xử lý — gọi từ ContentErrorReportReminderScheduler, chạy 1
     * lần/ngày. Hai nhánh độc lập, ứng với 2 kiểu "report bị bỏ quên":
     *   1. Còn PENDING (chưa CM nào claim) quá {@value #PENDING_UNCLAIMED_SLA_DAYS}
     *      ngày — không có assignedTo để báo riêng nên báo lại toàn bộ CM ACTIVE,
     *      cùng danh sách recipient với notifyContentManagersOfNewReport().
     *   2. Đã claim (IN_PROGRESS) nhưng đứng im quá
     *      {@value #IN_PROGRESS_STUCK_SLA_DAYS} ngày — chỉ báo đúng CM đang giữ.
     * Job chạy mỗi ngày nên gửi lại notification mỗi ngày cho report vẫn còn quá
     * hạn là nhắc nhở hợp lý, không cần cờ "đã nhắc" để dedupe.
     */
    @Override
    @Transactional
    public int remindOverdueReports() {
        int sent = 0;
        LocalDateTime now = LocalDateTime.now();

        List<ContentErrorReport> unclaimedOverdue = repository.findByStatusAndCreatedAtBefore(
                ReportStatus.PENDING, now.minusDays(PENDING_UNCLAIMED_SLA_DAYS));
        if (!unclaimedOverdue.isEmpty()) {
            List<UserAccount> contentManagers =
                    userRepository.findByRole_NameAndStatus("ROLE_CONTENT_MANAGER", "ACTIVE");
            if (contentManagers.isEmpty()) {
                log.warn("[report-sla] {} report PENDING qua {} ngay nhung khong co CM ACTIVE nao de bao",
                        unclaimedOverdue.size(), PENDING_UNCLAIMED_SLA_DAYS);
            } else {
                for (ContentErrorReport report : unclaimedOverdue) {
                    for (UserAccount cm : contentManagers) {
                        notificationRepository.save(Notification.builder()
                                .user(cm)
                                .type("CONTENT_ERROR_REPORT_PENDING_OVERDUE")
                                .title("Báo cáo lỗi nội dung chưa ai nhận")
                                .body("Một báo cáo lỗi về " + describeEntity(report)
                                        + " vẫn chưa được CM nào tiếp nhận sau " + PENDING_UNCLAIMED_SLA_DAYS + " ngày.")
                                .metadata(Map.of("reportId", report.getId().toString()))
                                .isRead(false)
                                .build());
                        sent++;
                    }
                }
            }
        }

        List<ContentErrorReport> stuckInProgress = repository.findByStatusAndAssignedAtBefore(
                ReportStatus.IN_PROGRESS, now.minusDays(IN_PROGRESS_STUCK_SLA_DAYS));
        for (ContentErrorReport report : stuckInProgress) {
            UserAccount assignee = report.getAssignedTo();
            if (assignee == null) {
                // Khong nen xay ra (IN_PROGRESS luon di kem claim), nhung phong thu:
                // khong co assignee thi khong biet bao ai, bo qua thay vi NPE ca job.
                log.warn("[report-sla] Report {} o IN_PROGRESS qua han nhung khong co assignedTo", report.getId());
                continue;
            }
            notificationRepository.save(Notification.builder()
                    .user(assignee)
                    .type("CONTENT_ERROR_REPORT_IN_PROGRESS_OVERDUE")
                    .title("Báo cáo bạn đang xử lý quá hạn")
                    .body("Báo cáo lỗi về " + describeEntity(report) + " bạn đã nhận vẫn chưa xử lý xong sau "
                            + IN_PROGRESS_STUCK_SLA_DAYS + " ngày.")
                    .metadata(Map.of("reportId", report.getId().toString()))
                    .isRead(false)
                    .build());
            sent++;
        }

        return sent;
    }

    /** Tên hiển thị + mã của một nội dung bị báo lỗi. {@code code} rỗng với loại không có mã. */
    private record EntityLabel(String name, String code) {}

    /** Mô tả ngắn dùng trong nội dung thông báo, vd: {@code Môn học "Lập trình Java" (PRJ301)}. */
    private String describeEntity(ContentErrorReport report) {
        String typeLabel = ENTITY_TYPE_LABELS.getOrDefault(report.getEntityType(),
                String.valueOf(report.getEntityType()));
        if (report.getEntityName() == null) {
            // Báo cáo cũ tạo trước khi có 2 cột tên/mã.
            return typeLabel;
        }
        String code = report.getEntityCode() != null ? " (" + report.getEntityCode() + ")" : "";
        return typeLabel + " \"" + report.getEntityName() + "\"" + code;
    }

    /**
     * Tra tên nội dung theo đúng loại được báo. Không tìm thấy → 400 chứ không
     * lặng lẽ cho qua: báo cáo trỏ vào nội dung không tồn tại thì Content Manager
     * không xử lý được, để nó vào DB chỉ tạo rác không ai xoá được.
     *
     * Việc tra theo ĐÚNG repository của từng loại cũng chính là phép kiểm loại:
     * gửi id của Môn học kèm entityType=MAJOR sẽ không khớp và bị chặn tại đây.
     */
    private EntityLabel resolveEntityLabel(ReportEntityType entityType, UUID entityId) {
        return switch (entityType) {
            case COURSE -> courseRepository.findById(entityId)
                    .map(c -> new EntityLabel(c.getName(), c.getCode()))
                    .orElseThrow(() -> notFound(entityType, entityId));
            case RESOURCE -> learningResourceRepository.findById(entityId)
                    .map(r -> new EntityLabel(r.getTitle(), null))
                    .orElseThrow(() -> notFound(entityType, entityId));
            case NARROW_SPEC -> narrowSpecRepository.findById(entityId)
                    .map(n -> new EntityLabel(n.getName(), n.getCode()))
                    .orElseThrow(() -> notFound(entityType, entityId));
            case SPECIALIZATION -> specializationRepository.findById(entityId)
                    .map(s -> new EntityLabel(s.getName(), s.getCode()))
                    .orElseThrow(() -> notFound(entityType, entityId));
            case MAJOR -> majorRepository.findById(entityId)
                    .map(m -> new EntityLabel(m.getName(), m.getCode()))
                    .orElseThrow(() -> notFound(entityType, entityId));
            case ROADMAP -> personalRoadmapRepository.findById(entityId)
                    .map(r -> new EntityLabel(r.getName(), null))
                    .orElseThrow(() -> notFound(entityType, entityId));
        };
    }

    private ResponseStatusException notFound(ReportEntityType entityType, UUID entityId) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Không tìm thấy nội dung " + entityType + " với id " + entityId);
    }

    private ContentErrorReport getReportAndVerifyOwnership(UUID reporterId, UUID reportId) {
        ContentErrorReport report = repository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));

        if (report.getStatus() == ReportStatus.DELETED) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
        }

        if (!report.getReporter().getId().equals(reporterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to access this report");
        }

        return report;
    }

    private ErrorReportResponse mapToResponse(ContentErrorReport report) {
        return mapToResponse(report, false);
    }

    private ErrorReportResponse mapToResponse(ContentErrorReport report, boolean maskIdentity) {
        return ErrorReportResponse.builder()
                .id(report.getId())
                .reporterId(maskIdentity ? null : (report.getReporter() != null ? report.getReporter().getId() : null))
                .entityType(report.getEntityType())
                .entityId(report.getEntityId())
                .entityName(report.getEntityName())
                .entityCode(report.getEntityCode())
                .description(report.getDescription())
                .status(report.getStatus())
                .processingNote(report.getProcessingNote())
                .deletedReason(report.getDeletedReason())
                .deletedBy(report.getDeletedBy())
                .assignedToId(report.getAssignedTo() != null ? report.getAssignedTo().getId() : null)
                .assignedToName(report.getAssignedTo() != null ? report.getAssignedTo().getDisplayName() : null)
                .createdAt(report.getCreatedAt())
                .updatedAt(report.getUpdatedAt())
                .build();
    }
}
