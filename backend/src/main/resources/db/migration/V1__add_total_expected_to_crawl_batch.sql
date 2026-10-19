-- ============================================================================
-- Thêm cột total_expected cho bảng crawl_batch
--
-- Mục đích : lưu tổng số job mà nguồn (VietnamWorks meta.nbHits) báo có ở trang
--            đầu, làm mẫu số tính % tiến độ cào.
-- Tính chất : ADDITIVE — chỉ thêm cột nullable, không sửa/xóa dữ liệu cũ.
--             Batch đã tồn tại giữ giá trị NULL và API trả crawlProgressPercent
--             = null (không lỗi chia 0).
-- Rollback  : ALTER TABLE crawl_batch DROP COLUMN total_expected;
--
-- LƯU Ý VẬN HÀNH: project hiện KHÔNG dùng Flyway/Liquibase (không có dependency
-- trong pom.xml). Schema đang do Hibernate quản lý qua
-- spring.jpa.hibernate.ddl-auto=update, nên khi start app ở local dev cột này sẽ
-- được tự thêm. File SQL này để chạy tay trên môi trường có tắt ddl-auto, và để
-- lưu vết thay đổi schema. CHƯA chạy trên bất kỳ môi trường nào.
-- ============================================================================

ALTER TABLE crawl_batch ADD COLUMN IF NOT EXISTS total_expected INTEGER;
