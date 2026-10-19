package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.CrawlerSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CrawlerSourceRepository extends JpaRepository<CrawlerSource, UUID> {
    Optional<CrawlerSource> findByAdapterKey(String adapterKey);

    /**
     * BR-38/BV-40a. Bắt buộc là UPDATE nguyên tử, không phải đọc-sửa-ghi qua
     * entity: {@code /run-all} tạo N batch (một mỗi Specialization) chạy song
     * song, và TẤT CẢ cùng trỏ vào một dòng {@code crawler_source} (luôn
     * {@code findByAdapterKey("vietnamworks")}). Đọc-sửa-ghi qua Java sẽ mất số
     * đếm khi hai batch cùng finishBatch() gần như đồng thời — UPDATE thô kèm
     * {@code consecutive_failures + 1} không có cửa sổ race đó.
     */
    @Modifying
    @Query(value = "UPDATE crawler_source SET consecutive_failures = 0, "
            + "first_failure_at = NULL, last_success_at = :now WHERE id = :id",
            nativeQuery = true)
    void recordSuccess(@Param("id") UUID id, @Param("now") LocalDateTime now);

    /**
     * Tăng nguyên tử và tự tắt {@code is_enabled} trong CÙNG một câu UPDATE khi
     * chuỗi fail đã kéo dài quá {@code staleCutoff} — không có khoảng hở giữa
     * "tăng số" và "kiểm tra ngưỡng" cho hai batch chen vào giữa.
     *
     * F-FE14-5/BR-38 — ngưỡng TẮT nguồn là VẾ THỜI GIAN (BV-40b: 7 ngày lỗi liên
     * tục), không phải vế số lần. Bản trước tắt ngay khi
     * {@code consecutive_failures + 1 >= 3}, tức là gộp luôn ngưỡng CẢNH BÁO
     * (BV-40a) vào ngưỡng TẮT — ba lượt fail trong vài phút (rất thường gặp khi
     * {@code /run-all} chạy song song nhiều Specialization và nguồn chỉ chập chờn
     * chốc lát) là đủ tắt nguồn. Vế 3 lần nay chỉ còn dùng để gửi cảnh báo, xử lý
     * ở tầng service.
     *
     * {@code COALESCE(first_failure_at, :now)} đọc GIÁ TRỊ CŨ của cột (mọi tham
     * chiếu cột trong SET đều đọc trạng thái trước UPDATE, cùng cơ chế với
     * {@code consecutive_failures + 1}): lượt fail đầu tiên của một chuỗi có
     * {@code first_failure_at} NULL nên rơi về {@code :now}, luôn lớn hơn
     * {@code staleCutoff} và không bao giờ tự tắt ngay ở lượt đầu.
     */
    @Modifying
    @Query(value = "UPDATE crawler_source SET "
            + "consecutive_failures = consecutive_failures + 1, "
            + "first_failure_at = COALESCE(first_failure_at, :now), "
            + "is_enabled = CASE WHEN COALESCE(first_failure_at, :now) <= :staleCutoff "
            + "THEN false ELSE is_enabled END "
            + "WHERE id = :id",
            nativeQuery = true)
    void recordFailureAndMaybeDisable(@Param("id") UUID id, @Param("now") LocalDateTime now,
            @Param("staleCutoff") LocalDateTime staleCutoff);

    /** Admin bật lại nguồn sau khi bị tự động tắt — cho chuỗi fail bắt đầu lại từ 0. */
    @Modifying
    @Query(value = "UPDATE crawler_source SET consecutive_failures = 0, first_failure_at = NULL WHERE id = :id",
            nativeQuery = true)
    void resetFailureCounter(@Param("id") UUID id);
}
