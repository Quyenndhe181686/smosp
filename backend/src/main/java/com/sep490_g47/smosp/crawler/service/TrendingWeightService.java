package com.sep490_g47.smosp.crawler.service;

import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.admin.service.SystemConfigReader;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.crawler.dto.request.BulkTrendingWeightDecisionRequest;
import com.sep490_g47.smosp.crawler.dto.request.TrendingWeightRollbackRequest;
import com.sep490_g47.smosp.crawler.dto.response.BulkTrendingWeightDecisionResponse;
import com.sep490_g47.smosp.crawler.dto.response.CurrentTrendingWeightResponse;
import com.sep490_g47.smosp.crawler.dto.response.TrendingWeightProposalResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProfile;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposal;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizedRepository;
import com.sep490_g47.smosp.crawler.repository.TrendingWeightProposalRepository;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecWeightConfig;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecWeightConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrendingWeightService {

    private final NarrowSpecRepository narrowSpecRepository;
    private final JobNormalizedRepository jobNormalizedRepository;
    private final SystemConfigReader systemConfigReader;
    private final NarrowSpecWeightConfigRepository weightConfigRepository;
    private final TrendingWeightProposalRepository proposalRepository;
    private final UserAccountRepository userAccountRepository;
    private final NotificationRepository notificationRepository;
    private final CrawlBatchRepository crawlBatchRepository;

    /**
     * Chính bean này, gọi qua proxy Spring.
     *
     * Duyệt hàng loạt cần MỖI đề xuất một transaction riêng: một dòng hỏng (ai đó
     * vừa duyệt mất, hoặc đã hết PENDING) không được phép kéo đổ những dòng đã xử
     * lý xong trước đó. Gọi thẳng {@code this.approveProposal()} là self-invocation
     * — proxy bị bỏ qua, tất cả rơi chung vào transaction của method gọi, và
     * exception đầu tiên đánh dấu rollback-only cho cả lượt.
     *
     * Cùng cái bẫy mà {@code CrawlServiceImpl} đã phải né bằng đúng cách này cho
     * {@code @Async}.
     */
    private final @org.springframework.context.annotation.Lazy TrendingWeightService self;

    /** Tính cho toàn bộ NS crawlable — giữ nguyên hành vi cũ của endpoint /calculate. */
    @Transactional
    public List<TrendingWeightProposal> calculateTrendingWeights() {
        return calculateTrendingWeights(null, null);
    }

    /** Tính theo scope Chuyên ngành, không gắn với phiên crawl nào. */
    @Transactional
    public List<TrendingWeightProposal> calculateTrendingWeights(UUID specializationId) {
        return calculateTrendingWeights(specializationId, null);
    }

    /**
     * @param specializationId giới hạn phạm vi tính vào các NS thuộc Specialization
     *        này (scope của crawl_batch vừa chạy xong); null = toàn bộ NS crawlable
     *        như trước.
     * @param crawlBatchId phiên crawl sinh ra đợt tính này, ghi thẳng vào từng
     *        proposal để màn duyệt biết "đợt" là gì mà không phải đoán theo đồng hồ.
     *        NULL khi chạy ngoài pipeline (calculate thủ công, recovery, sweeper).
     *
     * Lưu ý: Svol/Sacc chuẩn hoá theo NGƯỠNG CỐ ĐỊNH (tw_svol_cap, tw_sacc_cap), không
     * còn min-max theo tập NS đang xét. Nhờ đó điểm của một CNH không phụ thuộc vào
     * việc nó được tính chung với ai — chạy theo scope 1 Specialization hay chạy toàn
     * bộ đều cho cùng kết quả, và so ngang giữa các Specialization được.
     */
    @Transactional
    public List<TrendingWeightProposal> calculateTrendingWeights(UUID specializationId, UUID crawlBatchId) {
        // Đọc qua SystemConfigReader: Admin gõ nhầm một giá trị thì cả method này
        // trước đây ném NumberFormatException ngay dòng đầu và trả 500, không tính
        // được proposal nào kể cả Specialization không liên quan.
        int windowDays = systemConfigReader.getInt("tw_window_days", 15);
        int svolThreshold = systemConfigReader.getInt("svol_threshold", 5);
        double minPrevCoverage = systemConfigReader.getDouble("tw_min_prev_coverage", 0.8);
        // Ngưỡng phân loại EMERGING. Mặc định lấy từ dữ liệu 2026-08-06: 15 là
        // trung vị Svol của tập đủ điều kiện. Không phải hằng số thiêng — sensitivity
        // analysis cho thấy đổi sang 10 hoặc 27 vẫn giữ Spearman >= 0.94.
        int emergingMaxSvol = systemConfigReader.getInt("tw_emerging_max_svol", 15);
        double emergingMinSacc = systemConfigReader.getDouble("tw_emerging_min_sacc", 0.10);
        // Trần bão hoà của Svol. Xem khối giải thích ở chỗ tính svolNorm bên dưới.
        //
        // Guard bắt buộc: whitelist của AdminSystemConfigServiceImpl chỉ chặn ở endpoint
        // ghi, còn SystemConfigReader đọc thẳng DB — giá trị đặt bằng SQL tay hay seeder
        // cũ vẫn lọt. Với cap = 0, CNH có Svol = 0 cho 0.0/0.0 = NaN, rồi
        // BigDecimal.valueOf(NaN) ném NumberFormatException và làm hỏng CẢ đợt tính.
        // Cap âm thì sinh TW âm. Cả hai đều rơi về mặc định kèm cảnh báo.
        int svolCapRaw = systemConfigReader.getInt("tw_svol_cap", 30);
        int svolCap = svolCapRaw;
        if (svolCap < 1) {
            log.warn("[trending-weight] tw_svol_cap = {} không hợp lệ (phải >= 1) — dùng mặc định 30", svolCapRaw);
            svolCap = 30;
        }
        // Biên đối xứng của Sacc, cùng lý do guard như trên: cap = 0 cho phép chia 0.
        double saccCapRaw = systemConfigReader.getDouble("tw_sacc_cap", 0.7);
        double saccCap = saccCapRaw;
        if (saccCap <= 0) {
            log.warn("[trending-weight] tw_sacc_cap = {} không hợp lệ (phải > 0) — dùng mặc định 0.7", saccCapRaw);
            saccCap = 0.7;
        }

        LocalDate now = LocalDate.now();
        LocalDate startCurrent = now.minusDays(windowDays);
        LocalDate startPrevious = now.minusDays(2L * windowDays);
        LocalDate endPrevious = startCurrent.minusDays(1);

        // GUARD ĐỘ PHỦ CỬA SỔ TRƯỚC.
        //
        // Sacc = (svolCurrent - svolPrevious) / svolPrevious mang trọng số cao nhất
        // (0.5 ở 146/149 NS). Nhưng VietnamWorks không trả tin cũ hơn ~45 ngày, nên
        // nếu windowDays đặt quá lớn thì cửa sổ TRƯỚC rơi ra ngoài vùng có dữ liệu,
        // mẫu số teo lại và mọi NS bỗng "tăng trưởng" hàng trăm phần trăm.
        //
        // Đo thật ngày 2026-08-06 trên 118 NS:
        //   windowDays=30 -> cửa sổ trước phủ 37% số ngày -> trung vị Sacc +385%,
        //                    30/31 NS "tăng" trên 100%   <- artifact, không phải thị trường
        //   windowDays=15 -> cửa sổ trước phủ 100%       -> trung vị Sacc -4%, 1 NS trên 100%
        //
        // Kiểm tra bằng SỐ NGÀY CÓ DỮ LIỆU chứ không phải số tin: một cửa sổ 30 ngày
        // chỉ có 11 ngày có tin vẫn có thể nhiều tin, nhưng nó KHÔNG so sánh được với
        // cửa sổ 30/30 ngày. Đây chính là thứ lẽ ra phải chặn được lỗi trên từ đầu.
        long prevDaysWithData = jobNormalizedRepository.countDaysWithDataBetween(startPrevious, endPrevious);
        double prevCoverage = windowDays == 0 ? 0.0 : (double) prevDaysWithData / windowDays;
        boolean saccWindowReliable = prevCoverage >= minPrevCoverage;
        String saccGuardNote = null;

        if (!saccWindowReliable) {
            saccGuardNote = String.format(
                    "Sacc bi vo hieu: cua so truoc [%s, %s] chi co %d/%d ngay co du lieu (%.0f%%), "
                            + "duoi nguong %.0f%%. TW dot nay chi phan anh Svol.",
                    startPrevious, endPrevious, prevDaysWithData, windowDays,
                    prevCoverage * 100, minPrevCoverage * 100);
            log.error("[trending-weight] {} Giam tw_window_days hoac cao dinh ky de tich luy them lich su.",
                    saccGuardNote);
        } else {
            log.info("[trending-weight] Cua so truoc [{}, {}] phu {}/{} ngay ({}%) — Sacc dung duoc.",
                    startPrevious, endPrevious, prevDaysWithData, windowDays, Math.round(prevCoverage * 100));
        }

        List<NarrowSpecialization> activeNS = narrowSpecRepository.findCrawlableForTrendingWeight();
        if (specializationId != null) {
            activeNS = activeNS.stream()
                    .filter(ns -> ns.getSpecialization() != null
                            && specializationId.equals(ns.getSpecialization().getId()))
                    .toList();
            if (activeNS.isEmpty()) {
                log.warn("Không có NS crawlable nào thuộc Specialization {} — bỏ qua đợt tính trending weight",
                        specializationId);
                return List.of();
            }
        }

        Map<NarrowSpecialization, Double> svolMap = new HashMap<>();
        Map<NarrowSpecialization, Double> saccMap = new HashMap<>();
        Map<NarrowSpecialization, Double> juniorRatioMap = new HashMap<>();
        Map<NarrowSpecialization, Boolean> fallbackMap = new HashMap<>();
        Map<NarrowSpecialization, TrendingWeightProfile> profileMap = new HashMap<>();

        for (NarrowSpecialization ns : activeNS) {
            int svolCurrent = jobNormalizedRepository.countByNarrowSpec_IdAndPostedDateBetween(ns.getId(), startCurrent, now);
            int svolPrevious = jobNormalizedRepository.countByNarrowSpec_IdAndPostedDateBetween(ns.getId(), startPrevious, endPrevious);
            int juniorCount = jobNormalizedRepository.countByNarrowSpec_IdAndJuniorTrueAndPostedDateBetween(ns.getId(), startCurrent, now);

            double svol = svolCurrent;
            double sacc = 0.0;
            boolean isFallback = false;
            double juniorRatio = (svolCurrent == 0) ? 0.0 : (double) juniorCount / svolCurrent;

            if (!saccWindowReliable) {
                // Chặn ở mức toàn hệ thống: không NS nào có Sacc dùng được khi bản
                // thân cửa sổ trước không đủ dữ liệu để so sánh.
                isFallback = true;
            } else if (svolCurrent < svolThreshold) {
                isFallback = true;
                log.info("NS {} fallback: Svol_current ({}) < threshold ({})", ns.getCode(), svolCurrent, svolThreshold);
            } else if (svolPrevious < svolThreshold) {
                isFallback = true;
                log.info("NS {} fallback: Svol_previous ({}) < threshold ({}) — tang truong khong du tin cay thong ke", ns.getCode(), svolPrevious, svolThreshold);
            } else {
                sacc = (double) (svolCurrent - svolPrevious) / svolPrevious;
            }

            if (isFallback) {
                sacc = 0.0;
                juniorRatio = 0.0;
            }

            // Gán hồ sơ. SPARSE trùng khít với điều kiện fallback cũ — nghĩa là hành
            // vi ngầm trước đây giờ có tên và có mặt trong bảng cấu hình.
            TrendingWeightProfile profile;
            if (isFallback) {
                profile = TrendingWeightProfile.SPARSE;
            } else if (svolCurrent < emergingMaxSvol && sacc >= emergingMinSacc) {
                profile = TrendingWeightProfile.EMERGING;
            } else {
                profile = TrendingWeightProfile.MATURE;
            }

            svolMap.put(ns, svol);
            saccMap.put(ns, sacc);
            juniorRatioMap.put(ns, juniorRatio);
            fallbackMap.put(ns, isFallback);
            profileMap.put(ns, profile);
        }

        // Không còn tính min/max của đợt: CẢ HAI thành phần Svol và Sacc nay chuẩn hoá
        // theo ngưỡng cố định (tw_svol_cap, tw_sacc_cap). Nhờ đó điểm của một CNH chỉ
        // phụ thuộc chính nó — cào 3 CNH hay 149 CNH đều cho cùng kết quả, và không CNH
        // nào kéo được điểm của CNH khác xuống.
        //
        // juniorRatioNorm vốn đã là ratio * 100, không dùng min-max, nên không phải sửa.

        List<TrendingWeightProposal> proposals = new ArrayList<>();

        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        UserAccount currentUser = null;
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof com.sep490_g47.smosp.auth.security.CustomUserDetails userDetails) {
            currentUser = userAccountRepository.findById(userDetails.getUserId()).orElse(null);
        }

        // BẤT BIẾN: mỗi CNH nhiều nhất MỘT đề xuất đang chờ duyệt.
        //
        // Đợt tính này sắp ghi số liệu mới hơn cho đúng những CNH dưới đây, nên bản
        // PENDING cũ của chúng đã hết giá trị — duyệt nó là ghi vào NarrowSpec một
        // con số đã lỗi thời. Trước đây không có bước này: cào N lần là mỗi CNH có
        // N đề xuất cùng chờ, và vì màn duyệt lọc mặc định theo "đợt gần nhất" nên
        // CM duyệt xong một lớp thì lớp cũ hơn trồi lên — nhìn hệt như hệ thống tự
        // đẻ thêm đề xuất mới sau mỗi lần bấm Duyệt tất cả.
        supersedeStalePendingProposals(activeNS);

        // Đọc một lần ngoài vòng lặp: cùng một batch cho mọi proposal của đợt này.
        CrawlBatch crawlBatch = crawlBatchId == null
                ? null
                : crawlBatchRepository.findById(crawlBatchId).orElse(null);
        if (crawlBatchId != null && crawlBatch == null) {
            log.warn("[trending-weight] Không tìm thấy crawl_batch {} — đề xuất đợt này sẽ không gắn được đợt",
                    crawlBatchId);
        }

        for (NarrowSpecialization ns : activeNS) {
            double svolRaw = svolMap.get(ns);
            double saccRaw = saccMap.get(ns);
            double juniorRatioRaw = juniorRatioMap.get(ns);
            boolean isFallback = fallbackMap.get(ns);

            /* Svol chuẩn hoá theo TRẦN CỐ ĐỊNH, không theo min-max của đợt.
             *
             * Bản cũ: (svolRaw - minSvol) / (maxSvol - minSvol) * 100. Hai khuyết tật
             * đo được trên dữ liệu thật (2574 đề xuất, 2026-08-25):
             *
             * 1. THOÁI HOÁ Ở ĐỢT NHỎ. Cào một chuyên ngành lẻ chỉ có 3 CNH, và min-max
             *    trên cohort 3 phần tử luôn cho phần tử nhỏ nhất 0 điểm, lớn nhất 100
             *    điểm, bất kể giá trị thật. Một đợt thật trong DB có (min=0, max=3):
             *    CNH 3 tin tuyển dụng được 100/100. Đợt khác (min=2, max=10): CNH 2 tin
             *    bị 0 điểm dù có tin thật. TW khi đó chỉ mã hoá thứ tự trong 3 phần tử,
             *    không mang thông tin về nhu cầu thị trường.
             *
             * 2. NGOẠI LAI NÉN TOÀN BỘ PHẦN CÒN LẠI. Phân phối Svol lệch rất nặng:
             *    trung vị 2, p90 24, p95 31, max 145. Ở đợt phủ toàn bộ CNH, maxSvol=145
             *    kéo điểm trung bình xuống còn ~6/100 — gần như mọi CNH dồn về đáy chỉ
             *    vì một CNH bùng nổ.
             *
             * Cả hai làm TW không so sánh được giữa hai đợt: cùng một CNH, Svol tăng
             * 5→6 mà TW rơi 38→14 chỉ vì cohort đổi.
             *
             * Trần cố định sửa cả hai: svolNorm chỉ phụ thuộc chính CNH đó, nên cào 3
             * CNH hay 149 CNH đều cho cùng kết quả, và một CNH bùng nổ không kéo ai xuống.
             *
             * CAP = 30, chọn làm tròn ngay dưới p95 (p95 đo được = 31) cho dễ phát biểu.
             * Mô phỏng trên toàn bộ 2574 đề xuất tại CAP = 31: 5.9% CNH bão hoà ở 100
             * điểm, điểm trung bình 22.5. CAP = 30 lệch không đáng kể so với các số này.
             * Đáng chú ý: 22.5 CAO HƠN mức ~6 của bản min-max cũ trên đợt phủ toàn bộ,
             * vì bỏ được ngoại lai 145 tin vốn đang nén mọi CNH khác xuống đáy — đổi
             * sang trần cố định không hạ điểm toàn hệ thống mà nâng lên.
             * Diễn giải nghiệp vụ: từ 30 tin tuyển dụng trở lên coi là bão hoà nhu cầu.
             *
             * Vì sao TUYẾN TÍNH chứ không log: log(1+s)/log(1+30) cho CNH 2 tin tới 31.7
             * điểm — gần một phần ba đường tới "ngành hot" trong khi bằng chứng rất mỏng.
             * Hồ sơ SPARSE đã xử lý dữ liệu mỏng rồi; để log thổi điểm lên nữa là đếm
             * hai lần cùng một khuyết điểm. Tuyến tính cho 2 tin → 6.7 điểm, phản ánh
             * đúng thực tế gần như không có nhu cầu đo được. */
            double svolNorm = Math.min(svolRaw / svolCap, 1.0) * 100.0;
            /* Sacc chuẩn hoá theo BIÊN ĐỐI XỨNG cố định, không theo min-max của đợt.
             *
             * Cùng hai khuyết tật đã sửa cho Svol: cohort nhỏ thì thoái hoá, ngoại lai
             * thì nén phần còn lại. Riêng Sacc còn một hệ quả nữa được ghi thẳng trong
             * javadoc của TrendingWeightProfile: minSacc âm khiến sacc = 0 bị ánh xạ
             * thành 35.68 điểm — "cho không" một khoản điểm cho thứ không đo được.
             *
             * Khác Svol ở chỗ Sacc là TỐC ĐỘ TĂNG TRƯỞNG, có giá trị âm, nên không áp
             * trần một phía được. Đo trên 891 đề xuất không fallback (2026-08-25):
             *
             *     p05 -0.53 · p25 -0.27 · TRUNG VỊ -0.06 · p75 +0.17 · p95 +0.71
             *     54.5% âm · 5.7% bằng 0 · 39.7% dương
             *
             * Trung vị ÂM và quá nửa số CNH đang suy giảm. Nên phương án "chỉ thưởng
             * tăng trưởng" (map mọi giá trị âm về 0 điểm) bị loại: nó dồn 54.5% dữ liệu
             * vào một điểm duy nhất và xoá khả năng phân biệt của chính nhóm đa số.
             *
             * Ánh xạ đối xứng [-C, +C] -> [0, 100], C = 0.7 ≈ p95 (cùng nguyên tắc chọn
             * ngưỡng như tw_svol_cap). Kết quả trên phân phối thật:
             *
             *     -0.82 (min) -> 0    |  -0.53 -> 12.1  |  -0.06 (trung vị) -> 45.7
             *     +0.17 -> 62.1       |  +0.71 -> 100   |  +1.38 (max) -> 100
             *
             * sacc = 0 nhận 50 điểm là ĐÚNG, không phải điểm cho không: đứng yên phải
             * xếp trên suy giảm và dưới tăng trưởng. Khoản "cho không" mà javadoc enum
             * tố là trường hợp CNH bị ÉP sacc = 0 vì thiếu dữ liệu — nhóm đó nay là hồ
             * sơ SPARSE với w_sacc = 0, không nhận điểm Sacc nào. */
            double saccNorm = (Math.min(Math.max(saccRaw, -saccCap), saccCap) + saccCap) / (2 * saccCap) * 100.0;
            double juniorRatioNorm = juniorRatioRaw * 100.0;

            NarrowSpecWeightConfig weightConfig = weightConfigRepository.findByNarrowSpecId(ns.getId()).orElse(null);

            // Hồ sơ CM chỉ định tay thắng hồ sơ hệ thống tự gán.
            TrendingWeightProfile autoProfile = profileMap.get(ns);
            TrendingWeightProfile profile = autoProfile;
            if (weightConfig != null && weightConfig.getProfileOverride() != null) {
                profile = weightConfig.getProfileOverride();
                log.info("NS {} dung profile_override {} (he thong tu gan {})",
                        ns.getCode(), profile, autoProfile);
            }

            double wSvol = profile.getWSvol();
            double wSacc = profile.getWSacc();
            double wJunior = profile.getWJunior();

            double finalTw = wSvol * svolNorm + wSacc * saccNorm + wJunior * juniorRatioNorm;

            // Ghi hồ sơ và trọng số dẫn xuất trở lại bảng cấu hình, để bảng luôn
            // khớp hành vi thật. Trước đây bảng ghi w_sacc=0.5 trong khi code ép
            // Sacc=0 cho 60% số NS — mâu thuẫn đó nay không còn chỗ tồn tại.
            if (weightConfig != null) {
                weightConfig.setProfile(autoProfile);
                weightConfig.setWSvol(BigDecimal.valueOf(wSvol));
                weightConfig.setWSacc(BigDecimal.valueOf(wSacc));
                weightConfig.setWJunior(BigDecimal.valueOf(wJunior));
                weightConfigRepository.save(weightConfig);
            } else {
                log.warn("NS {} chua co narrow_spec_weight_config — dung trong so cua profile {} nhung khong ghi lai duoc",
                        ns.getCode(), profile);
            }

            Integer version = proposalRepository.findMaxVersionByNarrowSpecId(ns.getId()) + 1;

            TrendingWeightProposal proposal = TrendingWeightProposal.builder()
                    .narrowSpec(ns)
                    .svolNew(BigDecimal.valueOf(svolRaw))
                    .saccNew(BigDecimal.valueOf(saccRaw))
                    .juniorRatioNew(BigDecimal.valueOf(juniorRatioRaw))
                    .twNew(BigDecimal.valueOf(finalTw).setScale(2, RoundingMode.HALF_UP))
                    .twOld(ns.getCurrentTw())
                    // Ảnh chụp giá trị đang áp dụng, để màn duyệt hiện được "cũ → mới"
                    // cho từng thành phần chứ không chỉ TW tổng. NULL nếu CNH chưa
                    // từng có proposal được duyệt — không thay bằng 0.
                    .svolOld(ns.getCurrentSvol())
                    .saccOld(ns.getCurrentSacc())
                    .juniorRatioOld(ns.getCurrentJuniorRatio())
                    // Chụp phiên bản CÙNG LÚC chụp giá trị. NULL (CNH chưa từng duyệt
                    // đề xuất nào) coi như công thức 1 — không ảnh hưởng gì vì twOld
                    // cũng NULL, màn duyệt sẽ không vẽ phần "cũ →".
                    .twOldFormulaVersion(ns.getCurrentTwFormulaVersion() == null
                            ? TrendingWeightProposal.TW_FORMULA_VERSION_MINMAX
                            : ns.getCurrentTwFormulaVersion())
                    .status(TrendingWeightProposalStatus.PENDING)
                    .isFallback(isFallback)
                    .profile(profile)
                    // Ghi thẳng lý do vào proposal: CM duyệt nhìn thấy ngay vì sao TW
                    // đợt này không dùng Sacc, thay vì phải đi tra log.
                    .note(saccGuardNote)
                    .version(version)
                    .crawlBatch(crawlBatch)
                    .build();

            proposals.add(proposalRepository.save(proposal));
        }

        // BR-39 (phần làm được ngay, không cần BA): nếu MỌI proposal của đợt này
        // đều twNew = 0, đó là dấu hiệu sự cố hạ tầng (crawler hỏng / VietnamWorks
        // đổi schema) chứ không phải một đợt thị trường bình lặng thật. Trước đây
        // không có điều kiện nào phát hiện việc này — CM mở màn duyệt thấy một đợt
        // trông bình thường, bấm Duyệt, approveProposal() ghi thẳng currentTw=0 cho
        // toàn bộ, và hệ gợi ý mất sạch tín hiệu thị trường mà không ai đặt câu hỏi.
        //
        // CHỈ cảnh báo ở đây, KHÔNG chặn approve: chặn cần một bước "Admin xác
        // nhận" mà hiện chưa có UC/endpoint nào cho nó (UC-89 chỉ là dashboard
        // read-only), và cần khái niệm "batch" mà proposal hiện không có (không FK
        // tới crawl_batch — xem comment ở TrendingWeightProposalRepository). Cả hai
        // đều là quyết định thiết kế cần BA chốt trước, không tự làm được.
        boolean anomalous = !proposals.isEmpty()
                && proposals.stream().allMatch(p -> p.getTwNew().signum() == 0);

        if (anomalous) {
            flagAnomalousBatch(proposals);
        } else if (!proposals.isEmpty()) {
            // UC-92/AC-10-02: crawl batch hoan thanh phai bao cho Content Manager
            // biet co de xuat Trending Weight moi de vao duyet. Truoc day method
            // nay chi luu PENDING roi thoi — khong autowire NotificationRepository,
            // khong goi gi ca. CM chi biet co de xuat moi neu tu vao man duyet kiem
            // tra dinh ky.
            notifyContentManagersOfNewProposals(proposals);
        }

        return proposals;
    }

    /**
     * Đánh {@code SUPERSEDED} cho mọi đề xuất còn PENDING của tập CNH sắp được tính
     * lại, ngay trước khi ghi bản mới.
     *
     * KHÔNG đụng tới ACCEPTED / REJECTED / AUTO_REJECTED: đó là những quyết định đã
     * chốt, ghi đè lên chúng là xoá dấu vết CM đã làm gì. Chỉ bản chưa ai xem mới bị
     * thay thế.
     */
    private void supersedeStalePendingProposals(List<NarrowSpecialization> activeNS) {
        List<UUID> nsIds = activeNS.stream().map(NarrowSpecialization::getId).toList();
        if (nsIds.isEmpty()) {
            return;
        }

        List<TrendingWeightProposal> stale = proposalRepository
                .findByStatusAndNarrowSpec_IdIn(TrendingWeightProposalStatus.PENDING, nsIds);
        if (stale.isEmpty()) {
            return;
        }

        for (TrendingWeightProposal p : stale) {
            p.setStatus(TrendingWeightProposalStatus.SUPERSEDED);
        }
        proposalRepository.saveAll(stale);

        log.info("[trending-weight] Da danh SUPERSEDED {} de xuat PENDING cu cua {} CNH truoc khi ghi dot moi",
                stale.size(), nsIds.size());
    }

    /**
     * Duyệt nhiều đề xuất trong một request.
     *
     * KHÔNG gắn {@code @Transactional} ở đây — chủ ý. Mỗi lượt gọi qua {@code self}
     * mở transaction riêng, nên một đề xuất hỏng chỉ hỏng một dòng; phần đã duyệt
     * vẫn giữ nguyên. Bọc cả lượt trong một transaction thì exception đầu tiên đánh
     * dấu rollback-only và toàn bộ công việc trước đó mất trắng, trong khi response
     * vẫn báo "thành công N" — đúng kiểu lỗi âm thầm khó lần nhất.
     */
    public BulkTrendingWeightDecisionResponse bulkApprove(BulkTrendingWeightDecisionRequest request, String username) {
        return applyBulkDecision(request, username, true);
    }

    /** Từ chối nhiều đề xuất trong một request — xem {@link #bulkApprove}. */
    public BulkTrendingWeightDecisionResponse bulkReject(BulkTrendingWeightDecisionRequest request, String username) {
        return applyBulkDecision(request, username, false);
    }

    private BulkTrendingWeightDecisionResponse applyBulkDecision(
            BulkTrendingWeightDecisionRequest request, String username, boolean approve) {

        // Giữ nguyên thứ tự CM nhìn thấy trên màn, nhưng bỏ ID trùng: client gửi
        // trùng (bấm hai lần, lọc chồng nhau) thì lần thứ hai chắc chắn hỏng vì
        // đề xuất không còn PENDING — đếm nó là "thất bại" sẽ báo động giả.
        List<UUID> ids = new ArrayList<>(new java.util.LinkedHashSet<>(request.getProposalIds()));

        List<BulkTrendingWeightDecisionResponse.Item> results = new ArrayList<>(ids.size());
        int succeeded = 0;

        for (UUID id : ids) {
            try {
                TrendingWeightProposalResponse done = approve
                        ? self.approveProposal(id, username)
                        : self.rejectProposal(id, username);
                succeeded++;
                results.add(BulkTrendingWeightDecisionResponse.Item.builder()
                        .proposalId(id)
                        .narrowSpecCode(done.getNarrowSpecCode())
                        .success(true)
                        .build());
            } catch (Exception e) {
                log.warn("[trending-weight] Bulk {} that bai cho de xuat {}: {}",
                        approve ? "approve" : "reject", id, e.getMessage());
                results.add(BulkTrendingWeightDecisionResponse.Item.builder()
                        .proposalId(id)
                        .success(false)
                        .errorMessage(e.getMessage())
                        .build());
            }
        }

        log.info("[trending-weight] Bulk {}: {}/{} thanh cong (nguoi thuc hien: {})",
                approve ? "approve" : "reject", succeeded, ids.size(), username);

        return BulkTrendingWeightDecisionResponse.builder()
                .total(ids.size())
                .succeeded(succeeded)
                .failed(ids.size() - succeeded)
                .results(results)
                .build();
    }

    /** UC-92/AC-10-02 — một đợt tính TW mới (không bất thường) vừa sinh proposal. */
    private void notifyContentManagersOfNewProposals(List<TrendingWeightProposal> proposals) {
        List<UserAccount> contentManagers =
                userAccountRepository.findByRole_NameAndStatus("ROLE_CONTENT_MANAGER", "ACTIVE");
        if (contentManagers.isEmpty()) {
            log.warn("[trending-weight] Co {} de xuat TW moi nhung khong co CM ACTIVE nao de bao", proposals.size());
            return;
        }

        List<Notification> notifications = contentManagers.stream()
                .map(cm -> Notification.builder()
                        .user(cm)
                        .type("TRENDING_WEIGHT_PROPOSAL_CREATED")
                        .title("Có đề xuất Trending Weight mới")
                        .body("Vừa có " + proposals.size() + " đề xuất Trending Weight mới đang chờ duyệt.")
                        .metadata(Map.of("proposalCount", String.valueOf(proposals.size())))
                        .isRead(false)
                        .build())
                .toList();
        notificationRepository.saveAll(notifications);
    }

    /**
     * Ghi cảnh báo vào từng proposal (mượn cột {@code note} có sẵn, không thêm
     * cột mới) và báo cho cả CM lẫn Admin — BR-39 đòi cảnh báo cả hai vai, không
     * chỉ CM là người bấm duyệt.
     */
    private void flagAnomalousBatch(List<TrendingWeightProposal> proposals) {
        String anomalyNote = "ANOMALY (BR-39): toan bo " + proposals.size()
                + " proposal cua dot nay deu co TW = 0 - nghi ngo crawler/normalize loi. "
                + "Kiem tra du lieu truoc khi duyet.";
        log.error("[trending-weight] {}", anomalyNote);

        for (TrendingWeightProposal p : proposals) {
            p.setNote(p.getNote() != null ? p.getNote() + " | " + anomalyNote : anomalyNote);
        }
        proposalRepository.saveAll(proposals);

        List<UserAccount> recipients = new ArrayList<>();
        recipients.addAll(userAccountRepository.findByRole_NameAndStatus("ROLE_CONTENT_MANAGER", "ACTIVE"));
        recipients.addAll(userAccountRepository.findByRole_NameAndStatus("ROLE_ADMIN", "ACTIVE"));

        if (recipients.isEmpty()) {
            log.warn("[trending-weight] Batch bat thuong nhung khong co CM/Admin ACTIVE nao de bao");
            return;
        }

        List<Notification> notifications = recipients.stream()
                .map(user -> Notification.builder()
                        .user(user)
                        .type("TRENDING_WEIGHT_ANOMALY")
                        .title("Batch Trending Weight bất thường")
                        .body("Toàn bộ " + proposals.size() + " đề xuất Trending Weight vừa tính đều bằng 0. "
                                + "Có thể do crawler/normalize gặp sự cố. Vui lòng kiểm tra dữ liệu trước khi duyệt.")
                        .metadata(Map.of("proposalCount", String.valueOf(proposals.size())))
                        .isRead(false)
                        .build())
                .toList();
        notificationRepository.saveAll(notifications);
    }

    @Transactional(readOnly = true)
    public List<TrendingWeightProposalResponse> getProposals(TrendingWeightProposalStatus status) {
        List<TrendingWeightProposal> proposals = status != null ? 
                proposalRepository.findByStatusWithDetails(status) : 
                proposalRepository.findAllWithDetails();
        
        return proposals.stream().map(this::mapToResponse).toList();
    }

    @Transactional
    public TrendingWeightProposalResponse approveProposal(UUID id, String username) {
        TrendingWeightProposal proposal = proposalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Proposal not found"));
        
        if (proposal.getStatus() != TrendingWeightProposalStatus.PENDING) {
            throw new com.sep490_g47.smosp.common.exception.InvalidProposalStateException("Only PENDING proposals can be approved");
        }
        
        UserAccount user;
        try {
            user = userAccountRepository.findById(java.util.UUID.fromString(username)).orElse(null);
        } catch (IllegalArgumentException e) {
            user = userAccountRepository.findByUsername(username).orElse(null);
        }
        if (user == null) {
            user = userAccountRepository.findByEmail(username).orElseThrow(() -> new RuntimeException("User not found for identifier: " + username));
        }
                
        proposal.setStatus(TrendingWeightProposalStatus.ACCEPTED);
        proposal.setReviewedBy(user);
        proposal.setReviewedAt(LocalDateTime.now());
        
        NarrowSpecialization ns = proposal.getNarrowSpec();
        ns.setCurrentTw(proposal.getTwNew());
        // Ghi lại cả ba thành phần, không chỉ TW tổng: đây là nguồn để proposal LẦN SAU
        // biết giá trị cũ của mình là gì. Bỏ sót một dòng ở đây thì thành phần tương ứng
        // vĩnh viễn hiện "—" ở mọi đợt duyệt về sau.
        ns.setCurrentSvol(proposal.getSvolNew());
        ns.setCurrentSacc(proposal.getSaccNew());
        ns.setCurrentJuniorRatio(proposal.getJuniorRatioNew());
        // Ghi kèm phiên bản: từ đây current_tw thuộc thang của đề xuất vừa duyệt, và
        // đề xuất LẦN SAU sẽ chụp lại đúng phiên bản này làm twOldFormulaVersion.
        ns.setCurrentTwFormulaVersion(proposal.getTwFormulaVersion());
        narrowSpecRepository.save(ns);

        return mapToResponse(proposalRepository.save(proposal));
    }

    @Transactional
    public TrendingWeightProposalResponse rejectProposal(UUID id, String username) {
        TrendingWeightProposal proposal = proposalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Proposal not found"));
        
        if (proposal.getStatus() != TrendingWeightProposalStatus.PENDING) {
            throw new com.sep490_g47.smosp.common.exception.InvalidProposalStateException("Only PENDING proposals can be rejected");
        }
        
        UserAccount user;
        try {
            user = userAccountRepository.findById(java.util.UUID.fromString(username)).orElse(null);
        } catch (IllegalArgumentException e) {
            user = userAccountRepository.findByUsername(username).orElse(null);
        }
        if (user == null) {
            user = userAccountRepository.findByEmail(username).orElseThrow(() -> new RuntimeException("User not found for identifier: " + username));
        }
                
        proposal.setStatus(TrendingWeightProposalStatus.REJECTED);
        proposal.setReviewedBy(user);
        proposal.setReviewedAt(LocalDateTime.now());
        
        return mapToResponse(proposalRepository.save(proposal));
    }

    @Transactional(readOnly = true)
    public List<CurrentTrendingWeightResponse> getCurrentWeights() {
        return narrowSpecRepository.findAllByIsPublishedTrue().stream()
                .map(ns -> CurrentTrendingWeightResponse.builder()
                        .narrowSpecId(ns.getId())
                        .narrowSpecCode(ns.getCode())
                        .narrowSpecName(ns.getName())
                        .currentTw(ns.getCurrentTw())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TrendingWeightProposalResponse> getHistory(UUID narrowSpecId) {
        return proposalRepository.findByNarrowSpecIdOrderByVersionDesc(narrowSpecId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public TrendingWeightProposalResponse rollback(TrendingWeightRollbackRequest req, String username) {
        TrendingWeightProposal target = proposalRepository.findByNarrowSpecIdAndVersionAndStatus(
                req.getNarrowSpecId(), req.getTargetVersion(), TrendingWeightProposalStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target version not found or not ACCEPTED"));
        
        UserAccount user;
        try {
            user = userAccountRepository.findById(java.util.UUID.fromString(username)).orElse(null);
        } catch (IllegalArgumentException e) {
            user = userAccountRepository.findByUsername(username).orElse(null);
        }
        if (user == null) {
            user = userAccountRepository.findByEmail(username).orElseThrow(() -> new RuntimeException("User not found for identifier: " + username));
        }
                
        Integer maxVersion = proposalRepository.findMaxVersionByNarrowSpecId(req.getNarrowSpecId());
        
        if (req.getTargetVersion().equals(maxVersion)) {
            throw new com.sep490_g47.smosp.common.exception.InvalidProposalStateException("Cannot rollback to the currently active version");
        }
        
        TrendingWeightProposal newProposal = TrendingWeightProposal.builder()
                .narrowSpec(target.getNarrowSpec())
                .svolNew(target.getSvolNew())
                .saccNew(target.getSaccNew())
                .juniorRatioNew(target.getJuniorRatioNew())
                .twNew(target.getTwNew())
                .twOld(target.getNarrowSpec().getCurrentTw())
                // Giá trị "cũ" của bản rollback là thứ đang áp dụng NGAY TRƯỚC khi
                // rollback, không phải giá trị cũ của bản v được khôi phục.
                .svolOld(target.getNarrowSpec().getCurrentSvol())
                .saccOld(target.getNarrowSpec().getCurrentSacc())
                .juniorRatioOld(target.getNarrowSpec().getCurrentJuniorRatio())
                // Rollback CHÉP lại twNew của bản cũ, nên phải chép cả phiên bản công
                // thức đã sinh ra nó. Để @Builder.Default gán CURRENT_TW_FORMULA_VERSION
                // sẽ dán nhãn "công thức mới" lên một con số tính bằng công thức cũ.
                .twFormulaVersion(target.getTwFormulaVersion())
                .twOldFormulaVersion(target.getNarrowSpec().getCurrentTwFormulaVersion() == null
                        ? TrendingWeightProposal.TW_FORMULA_VERSION_MINMAX
                        : target.getNarrowSpec().getCurrentTwFormulaVersion())
                .status(TrendingWeightProposalStatus.ACCEPTED)
                .isFallback(target.isFallback())
                .version(maxVersion + 1)
                .note("Rolled back from v" + maxVersion + " to v" + req.getTargetVersion() + "'s values")
                .reviewedBy(user)
                .reviewedAt(LocalDateTime.now())
                .build();
                
        newProposal = proposalRepository.save(newProposal);
        
        NarrowSpecialization ns = target.getNarrowSpec();
        ns.setCurrentTw(newProposal.getTwNew());
        ns.setCurrentSvol(newProposal.getSvolNew());
        ns.setCurrentSacc(newProposal.getSaccNew());
        ns.setCurrentJuniorRatio(newProposal.getJuniorRatioNew());
        ns.setCurrentTwFormulaVersion(newProposal.getTwFormulaVersion());
        narrowSpecRepository.save(ns);
        
        return mapToResponse(newProposal);
    }

    @Transactional
    public List<TrendingWeightProposalResponse> rollbackBatch(List<TrendingWeightRollbackRequest> requests, String username) {
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }
        List<TrendingWeightProposalResponse> result = new ArrayList<>();
        for (TrendingWeightRollbackRequest req : requests) {
            result.add(rollback(req, username));
        }
        return result;
    }

    private TrendingWeightProposalResponse mapToResponse(TrendingWeightProposal p) {
        NarrowSpecialization ns = p.getNarrowSpec();
        UUID specId = (ns != null && ns.getSpecialization() != null) ? ns.getSpecialization().getId() : null;
        UUID majorId = (ns != null && ns.getSpecialization() != null && ns.getSpecialization().getMajor() != null) 
                ? ns.getSpecialization().getMajor().getId() : null;

        String reviewerName = null;
        if (p.getReviewedBy() != null) {
            if (p.getReviewedBy().getDisplayName() != null && !p.getReviewedBy().getDisplayName().isBlank()) {
                reviewerName = p.getReviewedBy().getDisplayName();
            } else if (p.getReviewedBy().getUsername() != null && !p.getReviewedBy().getUsername().isBlank()) {
                reviewerName = p.getReviewedBy().getUsername();
            } else {
                reviewerName = p.getReviewedBy().getEmail();
            }
        }

        CrawlBatch batch = p.getCrawlBatch();
        String batchScopeName = (batch != null && batch.getScopeSpecialization() != null)
                ? batch.getScopeSpecialization().getName() : null;
        String batchTriggeredBy = null;
        if (batch != null && batch.getTriggeredBy() != null) {
            UserAccount t = batch.getTriggeredBy();
            if (t.getDisplayName() != null && !t.getDisplayName().isBlank()) {
                batchTriggeredBy = t.getDisplayName();
            } else if (t.getUsername() != null && !t.getUsername().isBlank()) {
                batchTriggeredBy = t.getUsername();
            } else {
                batchTriggeredBy = t.getEmail();
            }
        }

        return TrendingWeightProposalResponse.builder()
                .crawlBatchId(batch != null ? batch.getId() : null)
                .crawlBatchStartedAt(batch != null ? batch.getStartedAt() : null)
                .crawlBatchScopeName(batchScopeName)
                .crawlBatchTriggeredBy(batchTriggeredBy)
                .id(p.getId())
                .narrowSpecId(ns != null ? ns.getId() : null)
                .narrowSpecCode(ns != null ? ns.getCode() : null)
                .narrowSpecName(ns != null ? ns.getName() : null)
                .specId(specId)
                .majorId(majorId)
                .svolNew(p.getSvolNew())
                .saccNew(p.getSaccNew())
                .juniorRatioNew(p.getJuniorRatioNew())
                .twNew(p.getTwNew())
                .twOld(p.getTwOld())
                .svolOld(p.getSvolOld())
                .saccOld(p.getSaccOld())
                .juniorRatioOld(p.getJuniorRatioOld())
                .status(p.getStatus())
                // NULL với đề xuất cũ tạo trước khi cột profile tồn tại — FE phải chịu
                // được null thay vì mặc định về MATURE.
                .profile(p.getProfile() == null ? null : p.getProfile().name())
                .profileLabel(p.getProfile() == null ? null : p.getProfile().getLabel())
                .twFormulaVersion(p.getTwFormulaVersion())
                .twOldFormulaVersion(p.getTwOldFormulaVersion())
                .isFallback(p.isFallback())
                .version(p.getVersion())
                .note(p.getNote())
                .reviewedAt(p.getReviewedAt())
                .reviewedBy(reviewerName)
                .createdAt(p.getCreatedAt())
                .build();
    }
}
