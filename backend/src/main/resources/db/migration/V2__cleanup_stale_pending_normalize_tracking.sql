-- ============================================================================
-- ONE-OFF DATA CLEANUP — KHÔNG phải schema migration, KHÔNG phải rule vĩnh viễn
--
-- Bối cảnh: 1 raw_job có thể nằm trong filter category của nhiều Specialization.
--           Khi batch của Specialization X cào lại job đó và payload đổi,
--           resetToPendingByRawJobId() đá tracking của MỌI Specialization về
--           PENDING — kể cả Specialization A đã normalize xong và đã bắn
--           NormalizeCompletedEvent của mình. A không còn sự kiện nào để chạy
--           lại ⇒ tracking nằm PENDING vĩnh viễn ("mồ côi").
--
-- Hệ quả nếu không dọn: mọi API đếm PENDING theo Specialization (normalize-status,
--           CrawlBatchMapper.resolveStage) đều tưởng hệ thống đang chuẩn hóa dở,
--           khiến UI bật spinner "đang chạy" vĩnh viễn dù không có gì chạy.
--
-- Quyết định của CM: coi backlog này là rác, đánh dấu FAILED và bỏ qua (không
--           normalize lại).
--
-- Đã chạy 2026-08-01: 3 record (cùng raw_job 5e1953e8-…, external_id 2083481,
--           trải 3 Specialization). Trước đó ngày 2026-07-30 backlog từng lên
--           tới 4142 record do cùng cơ chế.
--
-- Nguyên nhân gốc ĐÃ ĐƯỢC SỬA ở CrawlPipelineListener.sweepOrphanPendingTrackings()
-- — vòng quét tự dọn tracking mồ côi sau mỗi lần tính trending weight, có chặn
-- MAX_SWEEP_PASSES. Script này chỉ để dọn phần tồn đọng TRƯỚC khi có bản sửa đó.
--
-- CHẠY ĐÚNG 1 LẦN. Chạy lại lần 2 sẽ nuốt luôn các tracking PENDING hợp lệ mới
-- phát sinh sau này — nếu cần chạy lại, phải thêm điều kiện thời gian.
-- ============================================================================

-- ── BƯỚC 1: Xem trước, BẮT BUỘC chạy và đối chiếu con số trước khi UPDATE ──
-- Con số phải khớp với mốc vừa xác nhận. Nếu lệch nhiều, tức là đã có crawl mới
-- chạy trong lúc chờ → DỪNG LẠI, đừng chạy BƯỚC 2, vì sẽ đánh FAILED oan cả
-- tracking hợp lệ đang chờ xử lý.

SELECT COUNT(*) AS pending_se_bi_danh_dau_failed
FROM job_normalize_tracking
WHERE status = 'PENDING';

-- Chi tiết theo Specialization, để đối chiếu kỹ hơn nếu cần:
-- SELECT specialization_id, COUNT(*) FROM job_normalize_tracking
-- WHERE status = 'PENDING' GROUP BY specialization_id ORDER BY 2 DESC;


-- ── BƯỚC 2: Chỉ chạy sau khi đã xác nhận con số ở BƯỚC 1 ──
-- Bọc trong transaction để còn ROLLBACK nếu số dòng UPDATE không như mong đợi.

-- BEGIN;

UPDATE job_normalize_tracking
SET status       = 'FAILED',
    error        = 'Stale backlog — marked during pipeline migration cleanup (pre-auto-chain, batch 2026-07-30)',
    processed_at = NOW()
WHERE status = 'PENDING';

-- Kiểm tra lại rồi mới COMMIT:
-- SELECT status, COUNT(*) FROM job_normalize_tracking GROUP BY status;
-- COMMIT;   -- hoặc ROLLBACK; nếu số liệu sai

-- ── Rollback sau khi đã COMMIT (chỉ dùng nếu lỡ tay) ──
-- UPDATE job_normalize_tracking
-- SET status = 'PENDING', error = NULL, processed_at = NULL
-- WHERE status = 'FAILED'
--   AND error = 'Stale backlog — marked during pipeline migration cleanup (pre-auto-chain, batch 2026-07-30)';
