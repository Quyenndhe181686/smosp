-- V5 — Lưu giá trị CŨ của Svol / Sacc / JuniorRatio để màn duyệt Trending Weight hiển
-- thị được "cũ → mới" cho cả ba thành phần, không chỉ riêng TW.
--
-- Hiện trạng trước migration này:
--   - trending_weight_proposal chỉ có tw_old; svol/sacc/junior_ratio chỉ có bản _new.
--   - narrow_spec chỉ có current_tw.
--   => Giá trị cũ của ba thành phần KHÔNG tồn tại ở đâu cả. Màn lịch sử
--      (TrendingWeightHistoryPage) đang đọc currentSacc/currentSvol/currentJunior —
--      ba field không có trong API response — nên luôn hiển thị "0 → ...".
--
-- Thiết kế: nhân bản đúng cơ chế sẵn có của current_tw / tw_old.
--   - narrow_spec.current_*        : giá trị đang áp dụng, ghi khi duyệt proposal.
--   - trending_weight_proposal.*_old : ảnh chụp giá trị đang áp dụng tại thời điểm TẠO
--     proposal. Cùng ngữ nghĩa với tw_old — "proposal này được tính để thay cho cái gì".
--
-- Kiểu dữ liệu: KHÔNG ghi cứng precision/scale mà sao chép từ chính cột _new tương ứng.
-- Lý do: svol là số lượng tin tuyển dụng (có thể lên hàng nghìn) còn sacc/junior_ratio
-- là tỷ lệ 0..1 — ba thang đo khác nhau. Ghi cứng numeric(5,2) như current_tw sẽ tràn
-- số với svol; ghi cứng scale nhỏ sẽ cắt mất phần thập phân của tỷ lệ. Sao chép kiểu
-- bảo đảm cột cũ và cột mới luôn khớp nhau, kể cả khi cột _new được đổi kiểu sau này.
--
-- Dữ liệu cũ: mọi bản ghi hiện có nhận NULL — ĐÚNG như mong muốn. NULL nghĩa là "không
-- biết giá trị cũ", khác hẳn 0. Frontend PHẢI hiển thị "—" cho NULL; dùng `?? 0` sẽ tái
-- tạo lại đúng lỗi mà migration này sinh ra để sửa, chỉ khác là lần này khó phát hiện
-- hơn vì 0 trông như một con số thật.
--
-- BẮT BUỘC chạy tay: application.yml đặt spring.jpa.hibernate.ddl-auto=none, nên
-- Hibernate KHÔNG tự thêm cột. Không chạy file này thì ứng dụng sẽ lỗi khi khởi động
-- hoặc khi đọc/ghi proposal.
--
-- Rollback:
--   ALTER TABLE narrow_spec DROP COLUMN IF EXISTS current_svol, DROP COLUMN IF EXISTS current_sacc, DROP COLUMN IF EXISTS current_junior_ratio;
--   ALTER TABLE trending_weight_proposal DROP COLUMN IF EXISTS svol_old, DROP COLUMN IF EXISTS sacc_old, DROP COLUMN IF EXISTS junior_ratio_old;
-- ============================================================================

DO $$
DECLARE
    t_svol   text;
    t_sacc   text;
    t_junior text;
BEGIN
    -- Lấy kiểu thật của ba cột _new đang tồn tại.
    SELECT format_type(atttypid, atttypmod) INTO t_svol
    FROM pg_attribute
    WHERE attrelid = 'trending_weight_proposal'::regclass AND attname = 'svol_new' AND NOT attisdropped;

    SELECT format_type(atttypid, atttypmod) INTO t_sacc
    FROM pg_attribute
    WHERE attrelid = 'trending_weight_proposal'::regclass AND attname = 'sacc_new' AND NOT attisdropped;

    SELECT format_type(atttypid, atttypmod) INTO t_junior
    FROM pg_attribute
    WHERE attrelid = 'trending_weight_proposal'::regclass AND attname = 'junior_ratio_new' AND NOT attisdropped;

    IF t_svol IS NULL OR t_sacc IS NULL OR t_junior IS NULL THEN
        RAISE EXCEPTION 'Khong tim thay cot svol_new/sacc_new/junior_ratio_new tren trending_weight_proposal — kiem tra lai schema truoc khi chay migration nay';
    END IF;

    RAISE NOTICE 'Kieu du lieu sao chep: svol=%, sacc=%, junior_ratio=%', t_svol, t_sacc, t_junior;

    -- Giá trị đang áp dụng, ghi lại mỗi khi một proposal được duyệt.
    EXECUTE format('ALTER TABLE narrow_spec ADD COLUMN IF NOT EXISTS current_svol %s', t_svol);
    EXECUTE format('ALTER TABLE narrow_spec ADD COLUMN IF NOT EXISTS current_sacc %s', t_sacc);
    EXECUTE format('ALTER TABLE narrow_spec ADD COLUMN IF NOT EXISTS current_junior_ratio %s', t_junior);

    -- Ảnh chụp giá trị đang áp dụng tại thời điểm tạo proposal.
    EXECUTE format('ALTER TABLE trending_weight_proposal ADD COLUMN IF NOT EXISTS svol_old %s', t_svol);
    EXECUTE format('ALTER TABLE trending_weight_proposal ADD COLUMN IF NOT EXISTS sacc_old %s', t_sacc);
    EXECUTE format('ALTER TABLE trending_weight_proposal ADD COLUMN IF NOT EXISTS junior_ratio_old %s', t_junior);
END $$;

-- Nạp giá trị hiện hành cho narrow_spec từ proposal ACCEPTED mới nhất của từng CNH.
-- Không đụng tới *_old của proposal cũ: giá trị cũ tại thời điểm chúng được tạo là
-- thông tin đã mất, suy ngược lại sẽ là bịa số.
UPDATE narrow_spec ns
SET current_svol         = latest.svol_new,
    current_sacc         = latest.sacc_new,
    current_junior_ratio = latest.junior_ratio_new
FROM (
    SELECT DISTINCT ON (p.narrow_spec_id)
           p.narrow_spec_id, p.svol_new, p.sacc_new, p.junior_ratio_new
    FROM trending_weight_proposal p
    WHERE p.status = 'ACCEPTED'
    ORDER BY p.narrow_spec_id, p.version DESC
) AS latest
WHERE ns.id = latest.narrow_spec_id;

-- Đối chiếu: so số CNH đã có current_tw với số CNH vừa nạp được ba thành phần. Lệch
-- nhau nghĩa là có CNH từng được duyệt bằng luồng cũ mà không còn proposal ACCEPTED
-- (đã bị chuyển SUPERSEDED ở V4) — chấp nhận được, các CNH đó sẽ có giá trị ở lần
-- duyệt kế tiếp.
SELECT COUNT(*) FILTER (WHERE current_tw IS NOT NULL)   AS co_current_tw,
       COUNT(*) FILTER (WHERE current_svol IS NOT NULL) AS co_current_svol,
       COUNT(*) FILTER (WHERE current_sacc IS NOT NULL) AS co_current_sacc,
       COUNT(*)                                          AS tong_cnh
FROM narrow_spec;
