package com.sep490_g47.smosp.crawler.controller;

import com.sep490_g47.smosp.crawler.adapter.VietnamWorksAdapter;
import com.sep490_g47.smosp.crawler.dto.request.CancelCrawlRequest;
import com.sep490_g47.smosp.crawler.dto.request.CrawlRunRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlAllResponse;
import com.sep490_g47.smosp.crawler.dto.response.CrawlBatchResponse;
import com.sep490_g47.smosp.crawler.dto.response.NormalizeAllResponse;
import com.sep490_g47.smosp.crawler.service.CrawlQueryService;
import com.sep490_g47.smosp.crawler.service.CrawlService;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import com.sep490_g47.smosp.crawler.service.NormalizeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tầng biên của module crawler: chỉ nhận HTTP, kiểm quyền và trả response.
 *
 * Không tiêm repository nào — mọi truy vấn và nghiệp vụ nằm ở {@link CrawlService},
 * {@link CrawlQueryService} và {@link NormalizeService}. Nhờ vậy các luồng này gọi
 * lại được từ nơi khác (ví dụ một job chạy theo {@code crawler_source.schedule_cron}
 * sau này) mà không phải chép lại logic, và các endpoint đọc nhiều bảng chạy trong
 * một transaction thay vì mỗi truy vấn một thời điểm.
 */
@RestController
@RequestMapping("/api/cm/crawler")
@RequiredArgsConstructor
@Slf4j
public class CrawlerController {

    private final CrawlService crawlService;
    private final CrawlQueryService crawlQueryService;
    private final NormalizeService normalizeService;

    /**
     * Tạo batch RUNNING (transaction ngắn) rồi trả 202 kèm batch id ngay; phiên crawl
     * 20-30 phút chạy nền trên crawlExecutor. Client poll GET /batches/{id} để biết
     * kết quả.
     *
     * Từ khi có chuỗi tự động (CrawlPipelineListener), chỉ cần gọi endpoint này 1 lần:
     * cào xong sẽ tự chuẩn hóa rồi tự tính trending weight, FE không phải gọi tay
     * /normalize và /trending-weight/calculate nữa.
     */
    @PostMapping("/run")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<CrawlBatchResponse> runCrawl(
            @Valid @RequestBody CrawlRunRequest request,
            Authentication authentication) {
        return ResponseEntity.accepted()
                .body(crawlService.runOne(request.getSpecializationId(), authentication.getName()));
    }

    /**
     * Cào toàn bộ Chuyên ngành đang hoạt động đã cấu hình category. Số spec chạy
     * song song bị chặn ở corePoolSize=2 của pool, phần còn lại nằm queue.
     */
    @PostMapping("/run-all")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<CrawlAllResponse> runCrawlAll(Authentication authentication) {
        return ResponseEntity.accepted().body(crawlService.runAll(authentication.getName()));
    }

    /**
     * Xin dừng một phiên crawl đang chạy.
     *
     * Trả 202 chứ không 200: máy chủ mới chỉ ghi nhận yêu cầu, luồng crawl thoát ở
     * trang kế tiếp (vài giây sau). Client poll GET /batches/{id} để thấy status
     * chuyển sang CANCELLED.
     *
     * Ai được dừng: người đã bấm chạy phiên đó, hoặc Admin/Super Admin. Content
     * Manager khác nhận 403 — xem CrawlServiceImpl.requestCancel().
     */
    @PostMapping("/batches/{id}/cancel")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> cancelBatch(
            @PathVariable UUID id,
            @RequestBody(required = false) CancelCrawlRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(r -> "ROLE_ADMIN".equals(r) || "ROLE_SUPER_ADMIN".equals(r));
        crawlService.requestCancel(id, userDetails.getUserId(), isAdmin,
                request != null ? request.getReason() : null);
        return ResponseEntity.accepted()
                .body(Map.of("message", "Đã gửi yêu cầu dừng, phiên crawl sẽ dừng trong giây lát", "batchId", id));
    }

    /**
     * Dừng mọi phiên crawl người gọi được phép dừng — Admin dừng tất cả, Content
     * Manager chỉ dừng phiên của chính mình.
     */
    @PostMapping("/cancel-all")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> cancelAllBatches(
            @RequestBody(required = false) CancelCrawlRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(r -> "ROLE_ADMIN".equals(r) || "ROLE_SUPER_ADMIN".equals(r));
        int cancelled = crawlService.requestCancelAll(userDetails.getUserId(), isAdmin,
                request != null ? request.getReason() : null);
        return ResponseEntity.accepted().body(Map.of(
                "cancelled", cancelled,
                "message", cancelled == 0
                        ? "Không có phiên nào bạn được phép dừng"
                        : "Đã gửi yêu cầu dừng " + cancelled + " phiên"));
    }

    @GetMapping("/batches")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<CrawlBatchResponse>> getBatches() {
        return ResponseEntity.ok(crawlQueryService.getBatches());
    }

    @GetMapping("/batches/active")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<CrawlBatchResponse>> getActiveBatches() {
        return ResponseEntity.ok(crawlQueryService.getActiveBatches());
    }

    @GetMapping("/batches/{id}")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<CrawlBatchResponse> getBatchDetails(@PathVariable UUID id) {
        return ResponseEntity.ok(crawlQueryService.getBatchDetails(id));
    }

    @GetMapping("/batches/{id}/errors")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<VietnamWorksAdapter.CrawlError>> getBatchErrors(@PathVariable UUID id) {
        return ResponseEntity.ok(crawlQueryService.getBatchErrors(id));
    }

    /**
     * Normalize chạy ~20 phút nên cũng đẩy nền như /run. Tiến độ theo dõi qua
     * GET /batches/{id}/normalize-status.
     *
     * Từ khi có chuỗi tự động (CrawlPipelineListener), bước này đã tự chạy ngay sau
     * khi cào xong — endpoint giữ lại để CM CHẠY LẠI THỦ CÔNG khi mắt xích tự động
     * hỏng, hoặc khi muốn chuẩn hóa lại sau khi sửa keyword map.
     */
    @PostMapping("/batches/{id}/normalize")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
    public ResponseEntity<?> normalizeBatch(@PathVariable UUID id) {
        // Validate đồng bộ để batch không tồn tại / còn RUNNING vẫn báo lỗi ngay.
        normalizeService.validateBatchNormalizable(id);
        normalizeService.normalizeBatchAsync(id);
        return ResponseEntity.accepted()
                .body(Map.of("message", "Normalize đã được đưa vào hàng đợi", "batchId", id));
    }

    @PostMapping("/normalize-all")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
    public ResponseEntity<NormalizeAllResponse> normalizeAll() {
        return ResponseEntity.accepted().body(normalizeService.normalizeAll());
    }

    @GetMapping("/batches/{id}/normalize-status")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
    public ResponseEntity<Map<String, Object>> getNormalizeStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(crawlQueryService.getNormalizeStatus(id));
    }
}
