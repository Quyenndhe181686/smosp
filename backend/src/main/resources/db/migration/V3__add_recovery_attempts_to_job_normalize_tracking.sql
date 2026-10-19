-- ============================================================================
-- Thêm cột recovery_attempts cho bảng job_normalize_tracking
--
-- Mục đích : đếm số lần PipelineRecoveryRunner đã cố khôi phục 1 tracking sau khi
--            server khởi động lại. Bộ đếm được tăng và COMMIT NGAY trước khi
--            normalize chạy, nên nếu chính payload của tracking đó làm chết tiến
--            trình thì lần khởi động sau vẫn đọc được số đã tăng. Vượt ngưỡng
--            smosp.crawler.recovery.max-attempts thì tracking bị đánh FAILED và
--            loại khỏi hàng đợi khôi phục — đây là thứ làm gãy vòng lặp
--            "restart ➔ normalize ➔ chết ➔ restart".
--
-- Tính chất : ADDITIVE — chỉ thêm cột, có DEFAULT 0 nên dòng cũ tự nhận giá trị 0,
--            không phá dữ liệu và không cần backfill.
-- Rollback  : ALTER TABLE job_normalize_tracking DROP COLUMN recovery_attempts;
--
-- LƯU Ý VẬN HÀNH: project KHÔNG dùng Flyway/Liquibase (không có dependency trong
-- pom.xml). Schema do Hibernate quản lý qua spring.jpa.hibernate.ddl-auto=update,
-- nên khi start app ở local dev cột này được tự thêm. File SQL để chạy tay trên
-- môi trường có tắt ddl-auto, và để lưu vết thay đổi schema.
-- CHƯA chạy trên bất kỳ môi trường nào.
-- ============================================================================

ALTER TABLE job_normalize_tracking
    ADD COLUMN IF NOT EXISTS recovery_attempts INTEGER NOT NULL DEFAULT 0;

-- Truy vấn điều tra khi thấy log "[recovery] BỎ CUỘC với N tracking...":
-- SELECT t.raw_job_id, r.external_id, r.title_raw, t.recovery_attempts, t.error
-- FROM job_normalize_tracking t JOIN raw_job r ON r.id = t.raw_job_id
-- WHERE t.recovery_attempts > 0 ORDER BY t.recovery_attempts DESC;
