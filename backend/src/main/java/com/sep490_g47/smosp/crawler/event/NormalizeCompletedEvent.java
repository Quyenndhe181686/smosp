package com.sep490_g47.smosp.crawler.event;

import java.util.UUID;

/**
 * Bắn ra khi đã xử lý hết job_normalize_tracking PENDING của batch — mọi tracking
 * đều đã chốt trạng thái (SUCCESS hay FAILED đều tính là "xong"). Mắt xích 2 của
 * chuỗi tự động, kích hoạt bước tính trending weight.
 *
 * @param batchId          crawl_batch.id đã normalize xong. NULL khi đợt normalize
 *                         không xuất phát từ một batch cụ thể — PipelineRecoveryRunner
 *                         chạy lại sau restart, hoặc POST /normalize-all. Bên nhận
 *                         BẮT BUỘC phải chịu được null.
 * @param specializationId Specialization mà đợt normalize chạy trên đó — dùng làm
 *                         scope tính trending weight
 */
public record NormalizeCompletedEvent(UUID batchId, UUID specializationId) {
}
