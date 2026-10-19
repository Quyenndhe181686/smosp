-- V6 — Đánh dấu công thức nào sinh ra mỗi giá trị Trending Weight.
--
-- VÌ SAO CẦN
-- Công thức chuẩn hoá Svol vừa đổi từ min-max theo đợt sang trần cố định
-- (tw_svol_cap). Mọi tw_new đã lưu trước đó tính theo thang CŨ — thang phụ thuộc vào
-- việc đợt cào đó gồm những CNH nào. Không đánh dấu thì bảng lịch sử trộn hai thang mà
-- nhìn không ra, và mọi so sánh "TW đợt này với đợt trước" đều sai lặng lẽ. Đây đúng
-- là căn bệnh mà việc đổi công thức định chữa, nên phải chặn ngay tại đây.
--
-- QUY ƯỚC
--   1 = min-max theo đợt cho CẢ Svol và Sacc:
--         svolNorm = (svol - minSvol) / (maxSvol - minSvol) * 100
--         saccNorm = (sacc - minSacc) / (maxSacc - minSacc) * 100
--       Phụ thuộc cohort. Với đợt 3 CNH thì phần tử nhỏ nhất luôn 0 điểm, lớn nhất
--       luôn 100 điểm bất kể giá trị thật. Riêng saccNorm còn phát điểm "cho không":
--       minSacc âm khiến sacc = 0 được ánh xạ thành ~35 điểm.
--   2 = ngưỡng cố định, không phụ thuộc cohort:
--         svolNorm = min(svol / tw_svol_cap, 1) * 100                    (cap 30)
--         saccNorm = (clamp(sacc, -C, C) + C) / (2C) * 100, C = tw_sacc_cap (0.7)
--       Chỉ phụ thuộc chính CNH đó, so sánh được giữa các đợt và qua thời gian.
--
-- Bản ghi cũ nhận 1. KHÔNG suy ngược để "quy đổi" chúng sang thang mới: giá trị
-- minSvol/maxSvol của từng đợt cũ không được lưu lại, nên mọi quy đổi đều là bịa số.
--
-- SAU KHI CHẠY FILE NÀY: gọi POST /api/cm/trending-weight/calculate một lượt để sinh
-- lại toàn bộ đề xuất theo công thức 2, rồi duyệt. Không cần cào lại — hàm calculate
-- đọc job_normalized đã có sẵn. Chừng nào chưa làm việc đó, narrow_spec.current_tw vẫn
-- là số theo thang cũ và đang được recommendation engine dùng trong
-- finalScore = alpha * profileScore + (1 - alpha) * currentTw, tức bảng xếp hạng gợi ý
-- đang trộn hai thang.
--
-- BẮT BUỘC chạy tay: ddl-auto=none nên Hibernate không tự thêm cột.
--
-- Rollback:
--   ALTER TABLE trending_weight_proposal DROP COLUMN IF EXISTS tw_formula_version;
-- ============================================================================

ALTER TABLE trending_weight_proposal
    ADD COLUMN IF NOT EXISTS tw_formula_version SMALLINT;

-- Mọi bản ghi đang tồn tại đều do công thức min-max sinh ra.
UPDATE trending_weight_proposal
SET tw_formula_version = 1
WHERE tw_formula_version IS NULL;

ALTER TABLE trending_weight_proposal
    ALTER COLUMN tw_formula_version SET DEFAULT 1;

ALTER TABLE trending_weight_proposal
    ALTER COLUMN tw_formula_version SET NOT NULL;

-- Đối chiếu: trước khi chạy calculate, toàn bộ phải là version 1.
SELECT tw_formula_version, COUNT(*) AS so_de_xuat
FROM trending_weight_proposal
GROUP BY tw_formula_version
ORDER BY tw_formula_version;
