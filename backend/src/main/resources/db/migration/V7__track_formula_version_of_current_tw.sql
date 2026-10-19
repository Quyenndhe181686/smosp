-- V7 — Ghi nhớ công thức nào sinh ra narrow_spec.current_tw, để màn duyệt không bao giờ
-- đặt cạnh nhau hai con số thuộc hai thang đo khác nhau.
--
-- VÌ SAO CẦN
-- V6 đã đánh dấu công thức trên từng đề xuất (tw_formula_version). Nhưng cột
-- "TW hiện tại -> mới" ở màn duyệt so tw_old với tw_new, mà tw_old là ảnh chụp của
-- narrow_spec.current_tw — và KHÔNG có gì cho biết current_tw được tính bằng công thức
-- nào. Hệ quả nhìn thấy ngay sau lần đổi công thức: màn duyệt hiện "100 -> 3", trong đó
-- 100 là điểm min-max theo đợt (v1) còn 3 là điểm trần cố định (v2). Hai thang khác
-- nhau, đặt cạnh nhau là mời người duyệt kết luận sai.
--
-- THIẾT KẾ: nhân bản đúng cặp đã có sẵn.
--   narrow_spec.current_tw                  <-> narrow_spec.current_tw_formula_version
--   trending_weight_proposal.tw_old         <-> trending_weight_proposal.tw_old_formula_version
-- Đề xuất chụp lại phiên bản cùng lúc chụp giá trị; lúc duyệt thì cả hai được ghi sang
-- narrow_spec. Frontend so tw_old_formula_version với tw_formula_version: lệch nhau thì
-- ẩn hẳn phần "cũ ->", chỉ hiện giá trị mới.
--
-- GIÁ TRỊ MẶC ĐỊNH = 1 cho toàn bộ dữ liệu hiện có. Đúng theo định nghĩa: mọi current_tw
-- và tw_old đang nằm trong DB đều do công thức min-max sinh ra. Các đề xuất v2 vừa tính
-- lại cũng nhận tw_old_formula_version = 1, vì tw_old của chúng chụp từ current_tw cũ —
-- và đó chính là các dòng cần ẩn phần so sánh.
--
-- BẮT BUỘC chạy tay: ddl-auto=none nên Hibernate không tự thêm cột.
--
-- Rollback:
--   ALTER TABLE narrow_spec DROP COLUMN IF EXISTS current_tw_formula_version;
--   ALTER TABLE trending_weight_proposal DROP COLUMN IF EXISTS tw_old_formula_version;
-- ============================================================================

ALTER TABLE narrow_spec
    ADD COLUMN IF NOT EXISTS current_tw_formula_version SMALLINT;

ALTER TABLE trending_weight_proposal
    ADD COLUMN IF NOT EXISTS tw_old_formula_version SMALLINT;

-- Mọi giá trị đang tồn tại đều thuộc công thức 1 (min-max theo đợt).
UPDATE narrow_spec
SET current_tw_formula_version = 1
WHERE current_tw_formula_version IS NULL;

UPDATE trending_weight_proposal
SET tw_old_formula_version = 1
WHERE tw_old_formula_version IS NULL;

ALTER TABLE narrow_spec
    ALTER COLUMN current_tw_formula_version SET DEFAULT 1;

ALTER TABLE trending_weight_proposal
    ALTER COLUMN tw_old_formula_version SET DEFAULT 1;

-- KHÔNG đặt NOT NULL cho narrow_spec.current_tw_formula_version: CNH chưa từng được
-- duyệt đề xuất nào thì current_tw IS NULL, và phiên bản của một giá trị không tồn tại
-- cũng phải là NULL. Ép NOT NULL sẽ gán nhãn "công thức 1" cho ô trống.
ALTER TABLE trending_weight_proposal
    ALTER COLUMN tw_old_formula_version SET NOT NULL;

-- Đối chiếu. Trước khi duyệt lượt đề xuất v2 hiện tại, kỳ vọng:
--   trending_weight_proposal: tw_formula_version = 2 nhưng tw_old_formula_version = 1
--     -> đúng những dòng mà màn duyệt phải ẩn phần "cũ ->".
--   narrow_spec: toàn bộ current_tw_formula_version = 1.
SELECT tw_formula_version, tw_old_formula_version, COUNT(*) AS so_de_xuat
FROM trending_weight_proposal
GROUP BY tw_formula_version, tw_old_formula_version
ORDER BY tw_formula_version, tw_old_formula_version;

SELECT current_tw_formula_version, COUNT(*) AS so_cnh,
       COUNT(*) FILTER (WHERE current_tw IS NULL) AS chua_co_tw
FROM narrow_spec
GROUP BY current_tw_formula_version;
