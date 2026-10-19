package com.sep490_g47.smosp.crawler.controller;

import com.sep490_g47.smosp.crawler.dto.request.BulkTrendingWeightDecisionRequest;
import com.sep490_g47.smosp.crawler.dto.request.TrendingWeightRollbackRequest;
import com.sep490_g47.smosp.crawler.dto.response.BulkTrendingWeightDecisionResponse;
import com.sep490_g47.smosp.crawler.dto.response.CurrentTrendingWeightResponse;
import com.sep490_g47.smosp.crawler.dto.response.TrendingWeightProposalResponse;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposal;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import com.sep490_g47.smosp.crawler.service.TrendingWeightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cm/crawler/trending-weight")
@PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
@RequiredArgsConstructor
public class TrendingWeightController {

    private final TrendingWeightService trendingWeightService;

    /**
     * Chạy lại thủ công bước tính trending weight cho TOÀN BỘ narrow spec crawlable.
     * Bình thường bước này đã tự chạy sau khi chuẩn hóa xong (CrawlPipelineListener,
     * scope theo Specialization của batch) — endpoint giữ lại để CM tính lại khi mắt
     * xích tự động hỏng, hoặc khi muốn tính lại toàn hệ thống sau khi đổi
     * tw_window_days / svol_threshold / bộ trọng số w_svol-w_sacc-w_junior.
     */
    @PostMapping("/calculate")
    public ResponseEntity<List<TrendingWeightProposal>> calculateTrendingWeights() {
        List<TrendingWeightProposal> proposals = trendingWeightService.calculateTrendingWeights();
        return ResponseEntity.ok(proposals);
    }

    @GetMapping("/proposals")
    public ResponseEntity<List<TrendingWeightProposalResponse>> getProposals(
            @RequestParam(required = false, defaultValue = "PENDING") TrendingWeightProposalStatus status) {
        return ResponseEntity.ok(trendingWeightService.getProposals(status));
    }

    @PostMapping("/proposals/{id}/approve")
    public ResponseEntity<TrendingWeightProposalResponse> approveProposal(
            @PathVariable UUID id, Authentication authentication) {
        return ResponseEntity.ok(trendingWeightService.approveProposal(id, authentication.getName()));
    }

    @PostMapping("/proposals/{id}/reject")
    public ResponseEntity<TrendingWeightProposalResponse> rejectProposal(
            @PathVariable UUID id, Authentication authentication) {
        return ResponseEntity.ok(trendingWeightService.rejectProposal(id, authentication.getName()));
    }

    /**
     * Duyệt hàng loạt. Thay cho việc màn duyệt chạy vòng lặp gọi
     * {@code /proposals/{id}/approve} từng cái — một đợt hơn trăm CNH là hơn trăm
     * request tuần tự.
     *
     * Luôn trả 200 kèm bảng kết quả từng dòng, kể cả khi có dòng hỏng: một đề xuất
     * không duyệt được (ai đó vừa duyệt mất) không làm hỏng những dòng đã xong, nên
     * đây không phải lỗi của cả request.
     */
    @PostMapping("/proposals/bulk-approve")
    public ResponseEntity<BulkTrendingWeightDecisionResponse> bulkApprove(
            @Valid @RequestBody BulkTrendingWeightDecisionRequest request, Authentication authentication) {
        return ResponseEntity.ok(trendingWeightService.bulkApprove(request, authentication.getName()));
    }

    @PostMapping("/proposals/bulk-reject")
    public ResponseEntity<BulkTrendingWeightDecisionResponse> bulkReject(
            @Valid @RequestBody BulkTrendingWeightDecisionRequest request, Authentication authentication) {
        return ResponseEntity.ok(trendingWeightService.bulkReject(request, authentication.getName()));
    }

    @GetMapping("/current")
    public ResponseEntity<List<CurrentTrendingWeightResponse>> getCurrentWeights() {
        return ResponseEntity.ok(trendingWeightService.getCurrentWeights());
    }

    @GetMapping("/history")
    public ResponseEntity<List<TrendingWeightProposalResponse>> getHistory(
            @RequestParam UUID narrowSpecId) {
        return ResponseEntity.ok(trendingWeightService.getHistory(narrowSpecId));
    }

    @PostMapping("/rollback")
    public ResponseEntity<TrendingWeightProposalResponse> rollback(
            @Valid @RequestBody TrendingWeightRollbackRequest request, Authentication authentication) {
        return ResponseEntity.ok(trendingWeightService.rollback(request, authentication.getName()));
    }

    @PostMapping("/rollback-batch")
    public ResponseEntity<List<TrendingWeightProposalResponse>> rollbackBatch(
            @Valid @RequestBody List<TrendingWeightRollbackRequest> requests, Authentication authentication) {
        return ResponseEntity.ok(trendingWeightService.rollbackBatch(requests, authentication.getName()));
    }
}
