package com.sep490_g47.smosp.crawler.service.impl;

import com.sep490_g47.smosp.crawler.dto.response.CrawlBatchResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.repository.TrendingWeightProposalRepository;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CrawlBatchMapper {

    public static final String STAGE_CRAWLING = "CRAWLING";
    public static final String STAGE_NORMALIZING = "NORMALIZING";
    public static final String STAGE_CALCULATING = "CALCULATING";
    public static final String STAGE_DONE = "DONE";
    public static final String STAGE_FAILED = "FAILED";
    /** Trùng tên với status CANCELLED của batch — phiên dừng thì stage cũng dừng. */
    public static final String STAGE_CANCELLED = "CANCELLED";

    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final TrendingWeightProposalRepository trendingWeightProposalRepository;

    /** 3 stage nghĩa là pipeline của batch vẫn đang chạy dở (dùng để lọc /batches/active). */
    public static boolean isInProgressStage(String stage) {
        return STAGE_CRAWLING.equals(stage)
                || STAGE_NORMALIZING.equals(stage)
                || STAGE_CALCULATING.equals(stage);
    }

    /**
     * @param includeStage tính thêm field stage. Tốn 2 query/batch nên chỉ bật cho
     *        endpoint trả về ít dòng (1 batch, hoặc danh sách batch đang chạy), không
     *        bật cho danh sách toàn bộ lịch sử.
     */
    public CrawlBatchResponse toResponse(CrawlBatch batch, boolean includeErrorLog, boolean includeStage) {
        Specialization spec = batch.getScopeSpecialization();
        UUID specId = spec != null ? spec.getId() : null;
        return CrawlBatchResponse.builder()
                .id(batch.getId())
                .status(batch.getStatus())
                .scopeSpecializationId(specId)
                // Bám theo includeStage: cờ đó vốn đã có nghĩa "tập kết quả nhỏ,
                // chấp nhận thêm query". Nạp tên cho danh sách toàn bộ lịch sử
                // (260+ dòng) sẽ là N+1 query chỉ để hiển thị.
                .scopeSpecializationName(includeStage && spec != null ? spec.getName() : null)
                .scopeSpecializationCode(includeStage && spec != null ? spec.getCode() : null)
                .totalFetched(batch.getTotalFetched())
                .totalParsed(batch.getTotalParsed())
                .totalErrors(batch.getTotalErrors())
                .totalExpected(batch.getTotalExpected())
                .crawlProgressPercent(crawlProgressPercent(batch))
                .stage(includeStage ? resolveStage(batch, specId) : null)
                .startedAt(batch.getStartedAt())
                .finishedAt(batch.getFinishedAt())
                .triggeredBy(batch.getTriggeredBy() != null ? batch.getTriggeredBy().getUsername() : null)
                .triggeredByName(resolveTriggeredByName(batch))
                .triggeredById(batch.getTriggeredBy() != null ? batch.getTriggeredBy().getId() : null)
                .cancelRequested(Boolean.TRUE.equals(batch.getCancelRequested()))
                .cancelledByName(resolveUserName(batch.getCancelledBy()))
                .cancelReason(batch.getCancelReason())
                .canCancel(canCurrentUserCancel(batch))
                .errorLog(includeErrorLog ? batch.getErrorLog() : null)
                .build();
    }

    /** Ưu tiên tên hiển thị; lùi về username khi tài khoản chưa đặt tên. */
    private String resolveUserName(com.sep490_g47.smosp.auth.entity.UserAccount user) {
        if (user == null) {
            return null;
        }
        String displayName = user.getDisplayName();
        return displayName != null && !displayName.isBlank() ? displayName : user.getUsername();
    }

    private String resolveTriggeredByName(CrawlBatch batch) {
        if (batch.getTriggeredBy() == null) {
            return null;
        }
        String displayName = batch.getTriggeredBy().getDisplayName();
        return displayName != null && !displayName.isBlank()
                ? displayName
                : batch.getTriggeredBy().getUsername();
    }

    /**
     * Người đang gọi API có được dừng phiên này không.
     *
     * Tính ở máy chủ để FE không phải tự so id rồi tự suy luận quyền — và quan
     * trọng hơn: đây CHỈ để ẩn/hiện nút. Quyền thật vẫn được kiểm lại trong
     * {@code CrawlServiceImpl.requestCancel()}, nên FE có sửa cờ này cũng vô ích.
     */
    private Boolean canCurrentUserCancel(CrawlBatch batch) {
        if (!"RUNNING".equals(batch.getStatus()) || Boolean.TRUE.equals(batch.getCancelRequested())) {
            return false;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        boolean isAdmin = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(r -> "ROLE_ADMIN".equals(r) || "ROLE_SUPER_ADMIN".equals(r));
        if (isAdmin) {
            return true;
        }
        if (!(auth.getPrincipal() instanceof CustomUserDetails userDetails)) {
            return false;
        }
        return batch.getTriggeredBy() != null
                && batch.getTriggeredBy().getId().equals(userDetails.getUserId());
    }

    /**
     * % tiến độ cào = số job đã đọc / tổng số job nguồn báo có.
     *
     * Ghi chú lệch so với đặc tả: đặc tả A2 ghi công thức theo total_parsed, nhưng
     * total_parsed đếm số tracking MỚI hoặc bị reset — cào lại một đợt không đổi gì
     * sẽ ra 0% dù đã đọc hết. total_fetched mới là số đo đúng của bước cào, và cũng
     * là số mà đặc tả A5 dùng để phân biệt stage CRAWLING. Đổi lại 1 dòng nếu muốn
     * bám công thức cũ.
     */
    private Integer crawlProgressPercent(CrawlBatch batch) {
        Integer expected = batch.getTotalExpected();
        if (expected == null || expected <= 0) {
            return null;
        }
        int fetched = batch.getTotalFetched() != null ? batch.getTotalFetched() : 0;
        return Math.min(100, (int) ((long) fetched * 100 / expected));
    }

    private String resolveStage(CrawlBatch batch, UUID specializationId) {
        if (STAGE_FAILED.equals(batch.getStatus())) {
            return STAGE_FAILED;
        }

        // Phải thoát SỚM, trước mọi phép đếm bên dưới.
        //
        // Batch dừng giữa chừng gần như luôn để lại tracking PENDING (các trang đã
        // ghi nhưng chưa kịp chuẩn hóa, và chuỗi tự động cũng đã bị chặn). Rơi
        // xuống nhánh đếm PENDING sẽ trả NORMALIZING vĩnh viễn — mà
        // isInProgressStage(NORMALIZING) = true, nên phiên đã dừng vẫn nằm mãi
        // trong /batches/active và màn theo dõi hiện "Đang chuẩn hóa" không bao giờ
        // hết.
        if (STAGE_CANCELLED.equals(batch.getStatus())) {
            return STAGE_CANCELLED;
        }

        if ("RUNNING".equals(batch.getStatus())) {
            Integer expected = batch.getTotalExpected();
            int fetched = batch.getTotalFetched() != null ? batch.getTotalFetched() : 0;
            // expected == null: trang đầu chưa về nên chưa biết tổng — vẫn đang cào.
            if (expected == null || fetched < expected) {
                return STAGE_CRAWLING;
            }
        }

        if (specializationId == null) {
            return STAGE_DONE;
        }

        // Chỉ tính tracking thuộc chính phiên chạy này. Nếu đếm PENDING toàn
        // Specialization thì một tracking mồ côi sót lại từ đợt crawl cũ cũng đủ ghim
        // batch ở NORMALIZING vĩnh viễn — đúng lỗi UI quay mãi đã gặp.
        if (batch.getStartedAt() != null
                && jobNormalizeTrackingRepository.countBySpecialization_IdAndStatusAndUpdatedAtGreaterThanEqual(
                        specializationId, "PENDING", batch.getStartedAt()) > 0) {
            return STAGE_NORMALIZING;
        }

        // trending_weight_proposal không có FK tới crawl_batch — coi là đã tính xong
        // nếu có proposal nào của Specialization này được tạo sau khi batch kết thúc.
        LocalDateTime since = batch.getFinishedAt() != null ? batch.getFinishedAt() : batch.getStartedAt();
        if (since != null
                && trendingWeightProposalRepository
                        .countByNarrowSpec_Specialization_IdAndCreatedAtAfter(specializationId, since) == 0) {
            return STAGE_CALCULATING;
        }

        return STAGE_DONE;
    }
}
