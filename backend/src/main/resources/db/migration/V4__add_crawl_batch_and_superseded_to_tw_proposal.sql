-- V4 — "Duyệt tất cả" càng duyệt càng lòi ra đề xuất mới.
--
-- Hai nguyên nhân, sửa cùng lúc trong file này:
--
-- 1. trending_weight_proposal không có đường nào nối về crawl_batch, nên màn duyệt
--    của CM phải TỰ ĐOÁN "đợt" ở client bằng cách gom các proposal tạo cách nhau
--    dưới 90 giây. Một lần "Thu thập tất cả ngành" chạy 2 luồng song song kéo dài
--    hàng chục phút, nên đúng một lần cào bị cắt vụn thành hàng chục "đợt" giả.
--    -> thêm cột crawl_batch_id.
--
-- 2. Mỗi lần tính lại đều ghi proposal mới cho MỌI CNH mà không đụng tới bản PENDING
--    cũ, nên cào N lần là mỗi CNH có N đề xuất cùng chờ duyệt. Màn duyệt lọc mặc
--    định theo "đợt gần nhất" nên chỉ thấy lớp trên cùng — duyệt hết lớp đó thì lớp
--    cũ hơn trồi lên.
--    -> thêm trạng thái SUPERSEDED, và dọn tồn kho hiện có ở cuối file.

ALTER TABLE trending_weight_proposal
    ADD COLUMN IF NOT EXISTS crawl_batch_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tw_proposal_crawl_batch'
    ) THEN
        ALTER TABLE trending_weight_proposal
            ADD CONSTRAINT fk_tw_proposal_crawl_batch
            FOREIGN KEY (crawl_batch_id) REFERENCES crawl_batch (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tw_proposal_batch
    ON trending_weight_proposal (crawl_batch_id);

-- Hibernate sinh sẵn một CHECK liệt kê cứng các giá trị của enum status. Không nới
-- nó ra thì mọi lần ghi SUPERSEDED đều bị DB chặn. Tên constraint là tên Hibernate
-- tự đặt (bảng_cột_check); dùng IF EXISTS để file vẫn chạy được trên schema tạo tay
-- không có constraint này.
ALTER TABLE trending_weight_proposal
    DROP CONSTRAINT IF EXISTS trending_weight_proposal_status_check;

ALTER TABLE trending_weight_proposal
    ADD CONSTRAINT trending_weight_proposal_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'AUTO_REJECTED', 'SUPERSEDED'));

-- Dọn tồn kho đang gây ra triệu chứng: với mỗi CNH chỉ giữ lại đề xuất PENDING mới
-- nhất (version cao nhất), phần còn lại là số liệu đã lỗi thời -> SUPERSEDED.
--
-- CHỈ đụng vào PENDING. ACCEPTED/REJECTED/AUTO_REJECTED là quyết định đã chốt, ghi
-- đè lên chúng là xoá dấu vết CM đã làm gì.
UPDATE trending_weight_proposal p
SET status = 'SUPERSEDED'
WHERE p.status = 'PENDING'
  AND p.version < (
      SELECT MAX(p2.version)
      FROM trending_weight_proposal p2
      WHERE p2.narrow_spec_id = p.narrow_spec_id
        AND p2.status = 'PENDING'
  );
