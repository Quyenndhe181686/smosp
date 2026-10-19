package com.sep490_g47.smosp.crawler.service;

import com.sep490_g47.smosp.crawler.dto.response.NormalizeAllResponse;
import com.sep490_g47.smosp.crawler.dto.response.NormalizeResultDto;
import java.util.UUID;

public interface NormalizeService {
    NormalizeResultDto normalizeBatch(UUID batchId);

    NormalizeResultDto normalizeBySpecialization(UUID specializationId);

    /** Tra specializationId của batch rồi normalize, chạy nền trên crawlExecutor. */
    void normalizeBatchAsync(UUID batchId);

    /** Normalize toàn bộ tracking PENDING của 1 Specialization, chạy nền trên crawlExecutor. */
    void normalizeBySpecializationAsync(UUID specializationId);

    /** Kiểm tra batch tồn tại + không còn RUNNING, để controller báo lỗi ngay trước khi chạy nền. */
    void validateBatchNormalizable(UUID batchId);

    /** Đưa mọi Chuyên ngành còn tracking PENDING vào hàng đợi normalize. */
    NormalizeAllResponse normalizeAll();
}
