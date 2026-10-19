package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.RawJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RawJobRepository extends JpaRepository<RawJob, UUID> {
    List<RawJob> findByNormalizeStatus(String status);
    Optional<RawJob> findByExternalId(String externalId);

    /**
     * F-FE14-3/BR-41 (compensating rollback, không phải rollback DB thật):
     * {@code batch_id} chỉ được gán lúc RawJob được TẠO MỚI, không đổi khi
     * batch sau chỉ ghi đè payload của job đã tồn tại (xem comment ở
     * {@code JobNormalizeTrackingRepository.countBySpecialization_IdAndStatusAndUpdatedAtGreaterThanEqual}).
     * Nên tập RawJob có batch_id = batch vừa FAILED chính xác là phần dữ liệu
     * MỚI do batch này sinh ra — xoá được an toàn, không đụng job đã có từ
     * trước mà batch này chỉ cập nhật lại nội dung.
     */
    @Modifying
    @Query("DELETE FROM RawJob r WHERE r.batch.id = :batchId")
    int deleteByBatchId(@Param("batchId") UUID batchId);
}
