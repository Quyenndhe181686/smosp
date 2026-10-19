package com.sep490_g47.smosp.crawler.service.impl;

import com.sep490_g47.smosp.crawler.entity.CrawlerKeywordMap;
import com.sep490_g47.smosp.crawler.entity.JobNormalizeTracking;
import com.sep490_g47.smosp.crawler.event.NormalizeCompletedEvent;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.CrawlerKeywordMapRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.service.NormalizeService;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import com.sep490_g47.smosp.admin.service.SystemConfigReader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.sep490_g47.smosp.crawler.dto.response.NormalizeAllResponse;
import com.sep490_g47.smosp.crawler.dto.response.NormalizeAllResultItem;
import com.sep490_g47.smosp.crawler.dto.response.NormalizeResultDto;
import com.sep490_g47.smosp.specialization.entity.Specialization;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class NormalizeServiceImpl implements NormalizeService {

    private final CrawlBatchRepository crawlBatchRepository;
    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final CrawlerKeywordMapRepository crawlerKeywordMapRepository;
    private final NormalizeItemProcessor normalizeItemProcessor;
    private final SpecializationRepository specializationRepository;
    private final SystemConfigReader systemConfigReader;
    private final CrawlPersistenceService crawlPersistenceService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Chính bean này qua proxy Spring — cần cho {@code normalizeAll()} gọi
     * {@code normalizeBySpecializationAsync()} mà vẫn giữ được {@code @Async}.
     * Xem javadoc tại {@code normalizeAll()}. {@code @Lazy} cắt vòng phụ thuộc.
     */
    private final @org.springframework.context.annotation.Lazy NormalizeService self;

    // KHÔNG @Transactional: method này chỉ orchestration (tra specializationId rồi
    // vào vòng lặp normalize chạy ~20 phút). Trước đây có @Transactional ở đây và
    // vì normalizeBySpecialization được gọi self-invocation nên transaction đó bao
    // trọn cả vòng lặp: outer transaction giữ 1 connection ở trạng thái suspended,
    // mỗi processOne (REQUIRES_NEW) lại xin thêm 1 connection nữa → 1 phiên normalize
    // ăn 2 connection liên tục suốt 20 phút.
    @Override
    public NormalizeResultDto normalizeBatch(UUID batchId) {
        return normalizeBySpecialization(resolveSpecializationId(batchId));
    }

    @Override
    public void validateBatchNormalizable(UUID batchId) {
        String status = crawlBatchRepository.findStatusById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));
        if ("RUNNING".equals(status)) {
            throw new com.sep490_g47.smosp.common.exception.CrawlerBusinessException(
                    "Cannot normalize a batch that is still running");
        }
    }

    /**
     * Đưa mọi Chuyên ngành còn tracking PENDING vào hàng đợi normalize.
     *
     * Đi qua {@code self} chứ không gọi thẳng {@code normalizeBySpecializationAsync()}:
     * gọi trong cùng class là self-invocation, Spring proxy bị bỏ qua và
     * {@code @Async} mất tác dụng — toàn bộ vòng lặp normalize (~20 phút mỗi Chuyên
     * ngành) sẽ chạy đồng bộ trên thread HTTP.
     */
    @Override
    public NormalizeAllResponse normalizeAll() {
        List<UUID> specializationIds =
                jobNormalizeTrackingRepository.findDistinctSpecializationIdsByStatus("PENDING");

        List<NormalizeAllResultItem> results = new ArrayList<>();
        for (UUID specializationId : specializationIds) {
            String specCode = specializationRepository.findById(specializationId)
                    .map(Specialization::getCode)
                    .orElse(null);
            self.normalizeBySpecializationAsync(specializationId);
            results.add(NormalizeAllResultItem.builder()
                    .specializationId(specializationId)
                    .specializationCode(specCode)
                    .success(true)
                    .build());
        }

        return NormalizeAllResponse.builder()
                .results(results)
                .totalSpecializationsProcessed(specializationIds.size())
                .totalSpecializationsFailed(0)
                .build();
    }

    private UUID resolveSpecializationId(UUID batchId) {
        validateBatchNormalizable(batchId);

        // Đọc thẳng FK thay vì batch.getScopeSpecialization().getId(): không còn
        // transaction/session bao ngoài nên quan hệ LAZY sẽ không nạp được.
        return crawlBatchRepository.findScopeSpecializationIdById(batchId)
                // Crawl toàn bộ — v1.0 chỉ hỗ trợ đúng 1 Specialization (SE),
                // hardcode lấy theo code "SE" (EX-04: v1.0 chỉ SE)
                .orElseGet(() -> specializationRepository.findByCode("IT-SE")
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                "Specialization SE chưa tồn tại trong DB"))
                        .getId());
    }

    @Override
    @Async("normalizeExecutor")
    public void normalizeBatchAsync(UUID batchId) {
        UUID specializationId = null;
        try {
            specializationId = resolveSpecializationId(batchId);
            normalizeBySpecialization(specializationId);

            // Tới đây mọi tracking PENDING của Specialization đã chốt trạng thái
            // (SUCCESS hay FAILED đều tính là "xong") — mắt xích 2 của chuỗi tự động,
            // kích hoạt bước tính trending weight. Bắn cả khi CM gọi thủ công qua
            // POST /batches/{id}/normalize để 2 luồng hành xử giống hệt nhau.
            eventPublisher.publishEvent(new NormalizeCompletedEvent(batchId, specializationId));
        } catch (Exception e) {
            // Async thread không có ai bắt exception — kết quả từng item đã nằm ở
            // job_normalize_tracking.status nên chỉ cần log. Nhưng lỗi ở TẦNG SERVICE
            // (tra không ra Specialization, keyword map hỏng...) làm cả batch dở dang,
            // phải đóng batch lại để CM thấy chứ không im lặng bỏ qua.
            log.error("Normalize batch {} failed (specialization {}) — đánh dấu batch FAILED, "
                    + "chạy lại bằng POST /api/cm/crawler/batches/{}/normalize",
                    batchId, specializationId, batchId, e);
            crawlPersistenceService.markPipelineFailed(batchId, "Normalize failed: " + e.getMessage());
        }
    }

    @Override
    @Async("normalizeExecutor")
    public void normalizeBySpecializationAsync(UUID specializationId) {
        try {
            NormalizeResultDto result = normalizeBySpecialization(specializationId);

            // batchId = null: đường vào này KHÔNG xuất phát từ một crawl_batch cụ thể
            // (PipelineRecoveryRunner sau restart, hoặc POST /normalize-all), nên không
            // có batch nào để đánh dấu khi lỗi. Vẫn phải bắn event: nếu không, dữ liệu
            // normalized vừa đổi mà trending weight giữ nguyên số cũ — đúng lỗi đã gặp
            // khi sửa keyword AI17_COM3/GD_COM3.1 rồi mà TW vẫn 0.00.
            if (result.getTotalSuccess() + result.getTotalFailed() > 0) {
                eventPublisher.publishEvent(new NormalizeCompletedEvent(null, specializationId));
            }
        } catch (Exception e) {
            log.error("Normalize specialization {} failed", specializationId, e);
        }
    }

    // KHÔNG @Transactional ở đây — mỗi raw_job được xử lý trong transaction
    // REQUIRES_NEW riêng của NormalizeItemProcessor (bean khác, đi qua Spring
    // proxy đúng cách). Nếu method này tự bọc @Transactional bao cả vòng lặp,
    // 1 job lỗi ở tầng DB (vd. duplicate key) sẽ đánh dấu rollback-only cho toàn
    // bộ transaction, làm tất cả job phía sau fail dây chuyền dù bản thân chúng
    // không có vấn đề gì (đã xác nhận qua log thật — UnexpectedRollbackException).
    // Lý do thứ hai: vòng lặp này chạy ~20 phút, transaction ở đây đồng nghĩa giữ
    // 1 connection suốt 20 phút, cộng thêm 1 connection nữa cho mỗi REQUIRES_NEW.
    @Override
    public NormalizeResultDto normalizeBySpecialization(UUID specializationId) {
        List<CrawlerKeywordMap> keywords = crawlerKeywordMapRepository.findActiveBySpecializationId(specializationId);

        // Compile regex 1 lần cho cả phiên, dùng lại cho mọi job
        // Created by: BaoTQ - 260813
        Map<CrawlerKeywordMap, Pattern> compiledPatterns = normalizeItemProcessor.compilePatterns(keywords);

        List<JobNormalizeTracking> pendingTrackings = jobNormalizeTrackingRepository
                .findBySpecialization_IdAndStatus(specializationId, "PENDING");

        int successCount = 0;
        int failCount = 0;
        int unmatchedCount = 0;
        int totalNormalizedCreated = 0;
        Map<String, Integer> breakdownMap = new HashMap<>();

        // parseInt nằm TRONG .map() nên .orElse(20) chỉ cứu khi THIẾU config, không
        // cứu khi config CÓ nhưng sai định dạng. Đây là config toàn cục, nên một giá
        // trị gõ nhầm làm vòng try/catch theo từng Specialization bên dưới bắt lỗi ở
        // MỌI lần lặp: response vẫn HTTP 200 với failed = tổng số Specialization,
        // success = 0 — rất dễ đọc nhầm thành "hôm nay không có job hợp lệ".
        int capScore = systemConfigReader.getInt("keyword_scoring_cap", 20);

        for (JobNormalizeTracking tracking : pendingTrackings) {
            try {
                NormalizeItemProcessor.ProcessOneResult result =
                        normalizeItemProcessor.processOne(tracking.getId(), specializationId, compiledPatterns, capScore);

                successCount++;
                totalNormalizedCreated += result.getCreatedCount();
                if (result.isUnmatched()) {
                    unmatchedCount++;
                } else {
                    for (String nsCode : result.getMatchedNsCodes()) {
                        breakdownMap.put(nsCode, breakdownMap.getOrDefault(nsCode, 0) + 1);
                    }
                }
            } catch (Exception e) {
                log.error("Failed to normalize tracking {}", tracking.getId(), e);
                failCount++;
                normalizeItemProcessor.markFailed(tracking.getId(), e.getMessage());
            }
        }

        log.info("Specialization {} normalize xong: {} raw jobs success (created {} normalized jobs), {} raw jobs failed",
                 specializationId, successCount, totalNormalizedCreated, failCount);

        List<NormalizeResultDto.BreakdownItem> breakdown = breakdownMap.entrySet().stream()
                .map(e -> new NormalizeResultDto.BreakdownItem(e.getKey(), e.getValue()))
                .toList();

        return NormalizeResultDto.builder()
                .totalSuccess(totalNormalizedCreated)
                .totalFailed(failCount)
                .unmatchedCount(unmatchedCount)
                .breakdown(breakdown)
                .build();
    }

}
