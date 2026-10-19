package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.JobNormalizeTracking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JobNormalizeTrackingRepository extends JpaRepository<JobNormalizeTracking, UUID> {

    Optional<JobNormalizeTracking> findByRawJob_IdAndSpecialization_Id(UUID rawJobId, UUID specializationId);

    List<JobNormalizeTracking> findBySpecialization_IdAndStatus(UUID specializationId, String status);

    long countBySpecialization_IdAndStatus(UUID specializationId, String status);

    /**
     * Đếm trong phạm vi 1 phiên chạy: chỉ tính tracking được đụng tới từ lúc batch
     * bắt đầu (updated_at >= startedAt của batch).
     *
     * KHÔNG lọc được bằng raw_job.batch_id: raw_job giữ nguyên batch_id của lần đầu
     * được tạo, batch sau cào lại chỉ ghi đè payload — nên một batch cào 457 job mà
     * toàn job cũ sẽ có gần như 0 raw_job trỏ về nó, làm số đếm luôn bằng 0.
     *
     * Mốc thời gian là cách duy nhất khoanh đúng phiên: tracking mồ côi tồn đọng từ
     * các đợt crawl trước (updated_at cũ hơn) không còn kéo tiến độ của batch mới
     * xuống nữa.
     */
    long countBySpecialization_IdAndStatusAndUpdatedAtGreaterThanEqual(
            UUID specializationId, String status, java.time.LocalDateTime since);

    @Query("SELECT DISTINCT t.specialization.id FROM JobNormalizeTracking t WHERE t.status = :status")
    List<UUID> findDistinctSpecializationIdsByStatus(@Param("status") String status);

    /**
     * Specialization còn tracking PENDING đã "nằm im" quá lâu — ứng viên cho vòng
     * quét dọn mồ côi ở CrawlPipelineListener.
     *
     * Mốc staleBefore là chốt an toàn: tracking vừa được tạo/reset trong vài phút
     * gần đây rất có thể đang nằm trong hàng đợi normalize của chính pipeline nó,
     * quét vào sẽ chạy song song với normalize thật và hai luồng cùng xử lý một
     * tracking (processOne chạy REQUIRES_NEW nên có thể ném lỗi rồi bị markFailed
     * oan). Chỉ đụng vào những gì chắc chắn không còn ai xử lý.
     */
    @Query("SELECT DISTINCT t.specialization.id FROM JobNormalizeTracking t "
            + "WHERE t.status = 'PENDING' AND t.updatedAt < :staleBefore")
    List<UUID> findSpecializationIdsWithStalePending(
            @Param("staleBefore") java.time.LocalDateTime staleBefore);

    // Reset mọi tracking (mọi Specialization) của raw_job này về PENDING khi payload
    // được refresh từ crawl mới — trả về số dòng bị đổi để cộng vào total_parsed.
    // recovery_attempts về 0: đây là việc MỚI, không phải việc cũ đang lỗi.
    @Modifying
    @Query("UPDATE JobNormalizeTracking t SET t.status = 'PENDING', t.error = null, t.processedAt = null, " +
           "t.recoveryAttempts = 0 " +
           "WHERE t.rawJob.id = :rawJobId AND t.status <> 'PENDING'")
    int resetToPendingByRawJobId(@Param("rawJobId") UUID rawJobId);

    /**
     * Tăng bộ đếm khôi phục cho mọi tracking còn PENDING. Gọi ở đầu quá trình khôi
     * phục sau restart và COMMIT NGAY, trước khi normalize chạy — nếu normalize làm
     * server chết thì lần khởi động sau vẫn đọc được số đã tăng.
     */
    @Modifying
    @Transactional
    @Query("UPDATE JobNormalizeTracking t SET t.recoveryAttempts = t.recoveryAttempts + 1 WHERE t.status = 'PENDING'")
    int incrementRecoveryAttemptsForPending();

    /**
     * Loại khỏi hàng đợi khôi phục những tracking đã thử quá nhiều lần mà vẫn PENDING
     * — nghi là "payload độc" làm chết tiến trình. Đánh FAILED để vòng lặp restart
     * dừng lại, dữ liệu raw_job vẫn còn nguyên để điều tra sau.
     */
    @Modifying
    @Transactional
    @Query("UPDATE JobNormalizeTracking t SET t.status = 'FAILED', t.error = :error, "
           + "t.processedAt = CURRENT_TIMESTAMP "
           + "WHERE t.status = 'PENDING' AND t.recoveryAttempts > :maxAttempts")
    int failPendingExceedingRecoveryAttempts(@Param("error") String error,
                                             @Param("maxAttempts") int maxAttempts);

    /**
     * F-FE14-3/BR-41 — dọn trước khi {@link RawJobRepository#deleteByBatchId}
     * xoá RawJob cha (FK raw_job_id NOT NULL, phải xoá con trước).
     *
     * Chỉ khoanh được tracking của raw_job MỚI do batch này tạo (raw_job.batch_id
     * = batchId). Tracking tạo mới cho một raw_job ĐÃ TỒN TẠI từ batch trước
     * (job cũ, lần đầu có Specialization này) không nằm trong phạm vi xoá —
     * raw_job đó không phải dữ liệu của batch fail, không có gì để rollback.
     */
    @Modifying
    @Query("DELETE FROM JobNormalizeTracking t WHERE t.rawJob.batch.id = :batchId")
    int deleteByRawJobBatchId(@Param("batchId") UUID batchId);
}
