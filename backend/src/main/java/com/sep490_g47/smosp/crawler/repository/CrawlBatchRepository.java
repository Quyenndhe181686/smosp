package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface CrawlBatchRepository extends JpaRepository<CrawlBatch, UUID> {
    java.util.Optional<CrawlBatch> findFirstByOrderByStartedAtDesc();
    java.util.Optional<CrawlBatch> findFirstByStatusInOrderByStartedAtDesc(java.util.Collection<String> statuses);

    @Query("SELECT b.scopeSpecialization.id, MAX(COALESCE(b.finishedAt, b.startedAt)) "
            + "FROM CrawlBatch b "
            + "WHERE b.status IN ('SUCCESS', 'PARTIAL_SUCCESS') "
            + "AND b.scopeSpecialization IS NOT NULL "
            + "GROUP BY b.scopeSpecialization.id")
    java.util.List<Object[]> findLatestSuccessTimeBySpecialization();

    @Query("SELECT MAX(COALESCE(b.finishedAt, b.startedAt)) "
            + "FROM CrawlBatch b "
            + "WHERE b.status IN ('SUCCESS', 'PARTIAL_SUCCESS') "
            + "AND b.scopeSpecialization IS NULL")
    java.util.Optional<java.time.LocalDateTime> findLatestGlobalSuccessTime();

    boolean existsByStatus(String status);

    java.util.List<CrawlBatch> findByStatus(String status);

    /**
     * "Có phiên cào nào ĐANG thực sự chạy không" — có chặn theo thời gian.
     *
     * Không dùng existsByStatus("RUNNING") trần: nếu thread cào chết vì Error
     * (OutOfMemoryError… — catch (Exception) không bắt được) thì batch nằm RUNNING
     * vĩnh viễn và sẽ khóa cứng vòng quét dọn tracking mồ côi. Batch bắt đầu quá lâu
     * thì coi như đã chết, không tính là đang chạy.
     */
    boolean existsByStatusAndStartedAtAfter(String status, java.time.LocalDateTime after);

    boolean existsByStatusAndScopeSpecialization_Id(String status, UUID specializationId);

    /**
     * Các batch của một Specialization đang ở trạng thái nào đó — dùng thay cho
     * {@code existsByStatusAndScopeSpecialization_Id} ở guard chặn crawl trùng.
     *
     * Phải lấy CẢ DANH SÁCH chứ không chỉ hỏi có/không: guard cần biết batch bắt
     * đầu từ bao giờ để phân biệt "đang chạy thật" với "đã chết mà không ai chốt
     * trạng thái". Bản exists() trần không có thông tin đó, nên một batch kẹt
     * RUNNING là chặn vĩnh viễn mọi lần cào sau của đúng Chuyên ngành đó.
     */
    java.util.List<CrawlBatch> findByStatusAndScopeSpecialization_Id(String status, UUID specializationId);

    /**
     * Batch còn RUNNING mà đã bắt đầu quá lâu — ứng viên "batch chết".
     *
     * Dùng cho vòng quét định kỳ đóng batch mồ côi. Ngưỡng thời gian là thứ phân
     * biệt batch đang cào dở (hợp lệ, phải để yên) với batch mà thread xử lý đã
     * chết mang theo trạng thái.
     */
    java.util.List<CrawlBatch> findByStatusAndStartedAtBefore(String status, java.time.LocalDateTime before);

    // Đọc thẳng cột status / FK scope_specialization_id mà không cần load cả entity —
    // dùng ở NormalizeServiceImpl, nơi không có transaction bao ngoài nên không thể
    // lazy-load quan hệ scopeSpecialization.
    @Query("SELECT b.status FROM CrawlBatch b WHERE b.id = :id")
    java.util.Optional<String> findStatusById(@Param("id") UUID id);

    /**
     * Đọc cờ xin dừng, gọi giữa MỖI trang crawl nên phải rẻ: chỉ lấy đúng 1 cột
     * boolean, không nạp entity, không đụng quan hệ LAZY (luồng crawl chạy trên
     * crawlExecutor, không có transaction/session bao ngoài).
     */
    @Query("SELECT b.cancelRequested FROM CrawlBatch b WHERE b.id = :id")
    java.util.Optional<Boolean> findCancelRequestedById(@Param("id") UUID id);

    /**
     * Đặt cờ xin dừng bằng UPDATE nguyên tử, chỉ khi batch còn RUNNING.
     *
     * @return số dòng đổi — 0 nghĩa là batch đã kết thúc trước đó (hoặc đã có người
     *         bấm dừng), bên gọi dựa vào đây để báo đúng thay vì im lặng coi như xong.
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE CrawlBatch b SET b.cancelRequested = true, "
         + "b.cancelledBy = (SELECT u FROM UserAccount u WHERE u.id = :requesterId), "
         + "b.cancelReason = :reason "
         + "WHERE b.id = :id AND b.status = 'RUNNING' AND b.cancelRequested = false")
    int requestCancel(@Param("id") UUID id,
                      @Param("requesterId") UUID requesterId,
                      @Param("reason") String reason);

    /** Ai bấm chạy phiên này — dùng để quyết ai được phép dừng. */
    @Query("SELECT b.triggeredBy.id FROM CrawlBatch b WHERE b.id = :id")
    java.util.Optional<UUID> findTriggeredByIdById(@Param("id") UUID id);

    /** Phiên cào đang chạy của một Chuyên ngành — để báo tên người đang giữ. */
    java.util.Optional<CrawlBatch> findFirstByStatusAndScopeSpecialization_IdOrderByStartedAtDesc(
            String status, UUID specializationId);

    @Query("SELECT b.scopeSpecialization.id FROM CrawlBatch b WHERE b.id = :id")
    java.util.Optional<UUID> findScopeSpecializationIdById(@Param("id") UUID id);

    java.util.List<CrawlBatch> findAllByOrderByStartedAtDesc();

    /**
     * Ứng viên cho GET /batches/active.
     *
     * Không thể lọc thẳng bằng status: status chuyển sang SUCCESS ngay khi cào xong,
     * trong khi normalize + tính trending weight vẫn đang chạy ngầm qua
     * CrawlCompletedEvent/NormalizeCompletedEvent — lọc theo status sẽ bỏ sót đúng
     * những batch đang ở stage NORMALIZING/CALCULATING.
     *
     * Stage thật phải tính runtime (CrawlBatchMapper.resolveStage) và mỗi lần tính
     * tốn 2 query, nên thu hẹp ứng viên trước: batch còn RUNNING, hoặc batch vừa
     * kết thúc trong khoảng thời gian gần đây. Batch cũ hơn thế chắc chắn đã DONE.
     */
    @Query("SELECT b FROM CrawlBatch b WHERE b.status = 'RUNNING' "
            + "OR (b.finishedAt IS NOT NULL AND b.finishedAt >= :finishedSince) "
            + "ORDER BY b.startedAt DESC")
    java.util.List<CrawlBatch> findActiveCandidates(@Param("finishedSince") java.time.LocalDateTime finishedSince);
    /** Batch chưa chốt: còn RUNNING, hoặc kết thúc bất thường mà không có finishedAt. */
    @Query("SELECT COUNT(b) FROM CrawlBatch b WHERE b.status = 'RUNNING' OR b.finishedAt IS NULL")
    long countUnfinished();

    long countBySourceId(UUID sourceId);
    java.util.Optional<CrawlBatch> findFirstBySourceIdOrderByStartedAtDesc(UUID sourceId);
    boolean existsBySourceIdAndStatus(UUID sourceId, String status);
}
