package com.sep490_g47.smosp.crawler.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490_g47.smosp.crawler.adapter.VietnamWorksAdapter;
import com.sep490_g47.smosp.crawler.dto.response.CrawlBatchResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizedRepository;
import com.sep490_g47.smosp.crawler.service.CrawlQueryService;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CrawlQueryServiceImpl implements CrawlQueryService {

    /**
     * Batch kết thúc quá mốc này thì chắc chắn đã DONE — khỏi tốn 2 query
     * resolveStage cho từng dòng lịch sử cũ. Nới rộng hơn nhiều so với thời gian
     * chạy thật của pipeline (crawl 20-30 phút + normalize ~20 phút) để batch chạy
     * chậm bất thường vẫn còn được nhận diện.
     */
    private static final int ACTIVE_BATCH_LOOKBACK_HOURS = 2;

    private final CrawlBatchRepository crawlBatchRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final JobNormalizedRepository jobNormalizedRepository;
    private final CrawlBatchMapper crawlBatchMapper;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public List<CrawlBatchResponse> getBatches() {
        return crawlBatchRepository.findAllByOrderByStartedAtDesc()
                .stream()
                .map(batch -> crawlBatchMapper.toResponse(batch, false, false))
                .collect(Collectors.toList());
    }

    /**
     * Cố ý KHÔNG lọc bằng status='RUNNING': status thành SUCCESS ngay khi cào xong,
     * trong khi normalize + tính trending weight còn chạy ngầm, nên lọc theo status
     * sẽ bỏ sót đúng 2 stage sau. Stage thật do CrawlBatchMapper.resolveStage() tính
     * runtime; repository chỉ thu hẹp ứng viên để không phải resolveStage cho toàn
     * bộ lịch sử batch cũ.
     */
    @Override
    @Transactional(readOnly = true)
    public List<CrawlBatchResponse> getActiveBatches() {
        LocalDateTime finishedSince = LocalDateTime.now().minusHours(ACTIVE_BATCH_LOOKBACK_HOURS);
        return crawlBatchRepository.findActiveCandidates(finishedSince)
                .stream()
                .map(batch -> crawlBatchMapper.toResponse(batch, false, true))
                .filter(response -> CrawlBatchMapper.isInProgressStage(response.getStage()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CrawlBatchResponse getBatchDetails(UUID batchId) {
        CrawlBatch batch = crawlBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));
        return crawlBatchMapper.toResponse(batch, true, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VietnamWorksAdapter.CrawlError> getBatchErrors(UUID batchId) {
        CrawlBatch batch = crawlBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));

        if (batch.getErrorLog() == null || batch.getErrorLog().isEmpty()) {
            return new ArrayList<>();
        }

        try {
            return objectMapper.readValue(batch.getErrorLog(),
                    new TypeReference<List<VietnamWorksAdapter.CrawlError>>() {});
        } catch (Exception e) {
            log.error("Không đọc được error_log của batch {}", batchId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to parse error log");
        }
    }

    /**
     * Tiến độ normalize của Chuyên ngành gắn với batch — client poll endpoint này.
     *
     * {@code @Transactional(readOnly = true)} không phải trang trí: method này chạy
     * 6+ truy vấn đếm rồi cộng lại. Chạy ngoài transaction thì mỗi truy vấn đọc ở
     * một thời điểm khác nhau, một job normalize chạy xong xen giữa hai lần đếm sẽ
     * làm pending + success + failed KHÔNG bằng total, và FE hiện phần trăm vô lý.
     *
     * Các key cũ (specializationId, pending, success, failed) giữ nguyên tên, nhưng
     * GIÁ TRỊ khoanh theo phiên chạy của batch (updated_at >= startedAt) thay vì
     * toàn Chuyên ngành. Số toàn Chuyên ngành vẫn tra được ở pendingSpecialization/
     * successSpecialization/failedSpecialization.
     *
     * GIỚI HẠN của breakdown: job_normalize_tracking khóa theo (raw_job,
     * specialization) — trước khi normalize xong thì chưa biết job thuộc narrow spec
     * nào, nên pending/failed KHÔNG tách được xuống mức NS và mang giá trị của
     * Chuyên ngành cha (giống nhau ở mọi dòng). Riêng "success" của mỗi dòng là số
     * liệu thật ở mức NS: số bản ghi job_normalized đã gán vào NS đó.
     */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getNormalizeStatus(UUID batchId) {
        CrawlBatch batch = crawlBatchRepository.findById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));
        Specialization scope = batch.getScopeSpecialization();
        if (scope == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch không gắn Specialization");
        }
        UUID specializationId = scope.getId();
        LocalDateTime since = batch.getStartedAt();

        // Số chính = phạm vi PHIÊN NÀY (tracking được đụng tới từ lúc batch bắt đầu).
        // Đếm toàn Chuyên ngành như trước khiến 1 tracking mồ côi sót lại từ đợt cũ
        // ghim pending > 0 vĩnh viễn, FE chờ pending === 0 nên quay mãi không dừng.
        long pending = jobNormalizeTrackingRepository
                .countBySpecialization_IdAndStatusAndUpdatedAtGreaterThanEqual(specializationId, "PENDING", since);
        long success = jobNormalizeTrackingRepository
                .countBySpecialization_IdAndStatusAndUpdatedAtGreaterThanEqual(specializationId, "SUCCESS", since);
        long failed = jobNormalizeTrackingRepository
                .countBySpecialization_IdAndStatusAndUpdatedAtGreaterThanEqual(specializationId, "FAILED", since);
        long total = pending + success + failed;
        Integer percent = total == 0 ? null : (int) ((success + failed) * 100 / total);

        long pendingSpec = jobNormalizeTrackingRepository.countBySpecialization_IdAndStatus(specializationId, "PENDING");
        long successSpec = jobNormalizeTrackingRepository.countBySpecialization_IdAndStatus(specializationId, "SUCCESS");
        long failedSpec = jobNormalizeTrackingRepository.countBySpecialization_IdAndStatus(specializationId, "FAILED");

        List<Map<String, Object>> breakdown = new ArrayList<>();
        for (NarrowSpecialization ns : narrowSpecRepository.findBySpecializationId(specializationId)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("narrowSpecId", ns.getId());
            row.put("narrowSpecName", ns.getName());
            row.put("narrowSpecCode", ns.getCode());
            row.put("pending", pending);
            row.put("success", jobNormalizedRepository.countByNarrowSpec_Id(ns.getId()));
            row.put("failed", failed);
            row.put("percent", percent);
            breakdown.add(row);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("specializationId", specializationId);
        body.put("pending", pending);
        body.put("success", success);
        body.put("failed", failed);
        body.put("total", total);
        body.put("percent", percent);
        body.put("pendingSpecialization", pendingSpec);
        body.put("successSpecialization", successSpec);
        body.put("failedSpecialization", failedSpec);
        body.put("breakdown", breakdown);
        return body;
    }
}
