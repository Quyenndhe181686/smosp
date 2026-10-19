    package com.sep490_g47.smosp.admin.service.impl;

import com.sep490_g47.smosp.admin.dto.request.SystemConfigUpdateRequest;
import com.sep490_g47.smosp.admin.dto.response.AiUsageStatsResponse;
import com.sep490_g47.smosp.admin.dto.response.SystemConfigResponse;
import com.sep490_g47.smosp.admin.dto.response.SystemStatsResponse;
import com.sep490_g47.smosp.admin.entity.SystemConfig;
import com.sep490_g47.smosp.admin.repository.AiApiUsageLogRepository;
import com.sep490_g47.smosp.admin.repository.SystemConfigRepository;
import com.sep490_g47.smosp.admin.service.AdminSystemConfigService;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import com.sep490_g47.smosp.crawler.repository.TrendingWeightProposalRepository;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminSystemConfigServiceImpl implements AdminSystemConfigService {

    /** Số tháng gần nhất hiển thị trên biểu đồ token AI của dashboard Admin. */
    private static final int TRACKED_MONTHS = 4;
    // Phai khop CHINH XAC key ma GeminiServiceImpl.generateContent() doc de chan
    // goi API va key ma DataSeeder seed — truoc day dashboard doc "ai_token_quota"
    // (khong ai seed key nay, luon fallback ve mac dinh rieng cua no) trong khi
    // gioi han THAT nam o "ai_monthly_token_quota" (DataSeeder seed = 1.000.000).
    // Admin nhin thay tran 5.000.000 nhung he thong that su chan o 1.000.000 —
    // 20% cua con so hien thi.
    private static final String AI_TOKEN_QUOTA_KEY = "ai_monthly_token_quota";
    private static final long DEFAULT_MONTHLY_TOKEN_QUOTA = 1_000_000L;
    private static final String AI_PROVIDER_GEMINI = "gemini";

    /**
     * L2_LAYER1_DEF_14 — whitelist ghi cho PUT /api/admin/system-config.
     *
     * Danh sách này KHONG chep tu doc defect ma tu doi chieu that trong code:
     * moi key duoc doc qua {@code SystemConfigReader.getInt/getDouble} hoac
     * {@code findByConfigKey} truc tiep, cong voi moi key duoc seed trong
     * {@code DataSeeder}. Ket qua doi chieu (2026-08-12):
     *   - crawler_max_pages_safety_cap, svol_threshold, tw_window_days,
     *     tw_min_prev_coverage, tw_emerging_max_svol, tw_emerging_min_sacc,
     *     ai_monthly_token_quota: co doc that qua SystemConfigReader.
     *   - keyword_scoring_cap: co doc that (NormalizeServiceImpl) nhung
     *     KHONG duoc seed trong DataSeeder — van phai whitelist vi day la
     *     duong duy nhat de key nay ton tai trong DB.
     *   - ai_provider, ai_model, ai_max_tokens, crawler_schedule: duoc seed
     *     va hien tren man Admin nhung KHONG noi nao doc lai (facade — cung
     *     goc voi L2_LAYER2_DEF_02/DEF_18, khong thuoc scope defect nay). Van
     *     giu trong whitelist (validator text, khong that miem) de khong be
     *     man cau hinh hien co; sieu ra ngoai la viec cua 2 defect kia.
     * Key khong nam trong danh sach -> 400, KHONG con tao ban ghi moi.
     *
     * F-FE16 (2026-08-18) — bo sung ai_endpoint + ai_api_key_masked. Man cau hinh
     * AI LUON gui ai_endpoint trong payload, va vong validate ca lo ben duoi nem
     * 400 ngay o key la dau tien, nen thieu hai key nay lam MOI lan bam "Luu" that
     * bai — khong phai thinh thoang, ma la 100%.
     *
     * CANH BAO khi nghiem thu: them vao whitelist chi sua loi 400. Gia tri
     * ai_endpoint luu duoc van CHUA co tac dung that — GeminiServiceImpl doc
     * endpoint/apiKey tu application.yml qua @Value, khong doc system_config (dung
     * defect F-FE16-11, chua sua). Dung bao cao "da fix luong cau hinh AI".
     */
    private static final Map<String, Predicate<String>> CONFIG_KEY_WHITELIST = buildConfigKeyWhitelist();

    private static Map<String, Predicate<String>> buildConfigKeyWhitelist() {
        Map<String, Predicate<String>> w = new HashMap<>();
        w.put("ai_provider", AdminSystemConfigServiceImpl::isNonBlank);
        w.put("ai_model", AdminSystemConfigServiceImpl::isNonBlank);
        w.put("ai_max_tokens", intInRange(1, Integer.MAX_VALUE));
        w.put("ai_monthly_token_quota", intInRange(1, Integer.MAX_VALUE));
        w.put("ai_endpoint", AdminSystemConfigServiceImpl::isHttpUrl);
        // Gia tri ĐÃ che (vd "AIza****abcd") do FE gui len de hien lai tren man —
        // KHONG phai API key that, khong dung de goi API duoc. Chi can non-blank.
        w.put("ai_api_key_masked", AdminSystemConfigServiceImpl::isNonBlank);
        // NAC-54-01: hai lan crawl phai cach nhau it nhat 24h. Man Admin luu key
        // nay duoi dang SO NGAY (DataCrawlerConfigPage gui String(days), doc lai
        // bang parseInt), nen chan >= 1 ngay chinh la chan >= 24h o dung diem ghi
        // ma UI dung. Truoc day chi isNonBlank — goi thang API dat duoc "0" hay
        // ca "abc"; rang buoc 24h that su chi ton tai o PUT /admin/crawler-sources
        // (AdminCrawlerSourceServiceImpl), endpoint khong mot man hinh nao goi.
        //
        // CON LECH, can BA chot: key nay duoc DataSeeder seed duoi dang CRON
        // ("0 0 0 * * MON") va mo ta "[DEPRECATED] dung crawler_source.schedule_cron
        // thay the", trong khi UI lai ghi/doc no duoi dang so ngay. Hai dinh dang
        // song song tren cung mot key, va hien khong noi nao doc lai ca hai. Sua
        // triet de = chot mot nguon su that duy nhat, vuot pham vi defect nay.
        w.put("crawler_schedule", intInRange(1, 30));
        // Giờ chạy trong ngày, dạng HH:mm (ví dụ "02:30").
        w.put("crawler_schedule_time", AdminSystemConfigServiceImpl::isValidTimeHHmm);
        // Ngày chạy tự động gần nhất, dạng YYYY-MM-DD. Scheduler ghi lại sau mỗi lần kích hoạt.
        w.put("crawler_last_auto_run", AdminSystemConfigServiceImpl::isNonBlank);
        // BV-37: 200 trang mac dinh; tran cung MAX_LISTINGS_PER_BATCH/HITS_PER_PAGE
        // da co o VietnamWorksAdapter, o day chi chan gia tri vo nghia o diem GHI.
        w.put("crawler_max_pages_safety_cap", intInRange(1, 1000));
        w.put("svol_threshold", intInRange(0, Integer.MAX_VALUE));
        w.put("tw_window_days", intInRange(1, 365));
        w.put("tw_min_prev_coverage", doubleInRange(0.0, 1.0));
        w.put("tw_emerging_max_svol", intInRange(0, Integer.MAX_VALUE));
        w.put("tw_emerging_min_sacc", doubleInRange(0.0, 1.0));
        // Trần bão hoà Svol. Chặn dưới ở 1 vì cap = 0 sẽ chia cho 0 trong svolNorm;
        // chặn trên ở 1000 trùng với trần crawler_max_pages_safety_cap — trên mức đó
        // thì mọi CNH đều dồn về sát 0 điểm và TW mất khả năng phân biệt.
        w.put("tw_svol_cap", intInRange(1, 1000));
        // Biên đối xứng Sacc. Chặn dưới > 0 vì cap = 0 chia cho 0 trong saccNorm.
        // Trần 5.0 = tăng trưởng 500%; trên mức đó mọi CNH dồn về sát 50 điểm.
        w.put("tw_sacc_cap", doubleInRange(0.05, 5.0));
        // Trung voi @Max(20) cua score o CreateKeywordRequest/UpdateKeywordRequest.
        w.put("keyword_scoring_cap", intInRange(1, 100));
        return w;
    }

    private static boolean isNonBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    /** Kiểm tra chuỗi có đúng định dạng HH:mm không (00:00 – 23:59). */
    private static boolean isValidTimeHHmm(String value) {
        if (!isNonBlank(value)) return false;
        return value.trim().matches("^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$");
    }

    /**
     * Endpoint AI phải là URL http(s) cú pháp hợp lệ. KHÔNG gọi thử kết nối ở đây:
     * validate ghi cấu hình phải trả lời nhanh và tất định, còn "endpoint này có
     * sống không" là việc của một nút Test connection riêng (AC-56-03, chưa có).
     */
    private static boolean isHttpUrl(String value) {
        if (!isNonBlank(value)) {
            return false;
        }
        try {
            String scheme = java.net.URI.create(value.trim()).getScheme();
            return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static Predicate<String> intInRange(int min, int max) {
        return value -> {
            try {
                int parsed = Integer.parseInt(value.trim());
                return parsed >= min && parsed <= max;
            } catch (NumberFormatException | NullPointerException ex) {
                return false;
            }
        };
    }

    private static Predicate<String> doubleInRange(double min, double max) {
        return value -> {
            try {
                double parsed = Double.parseDouble(value.trim());
                return parsed >= min && parsed <= max;
            } catch (NumberFormatException | NullPointerException ex) {
                return false;
            }
        };
    }

    private final SystemConfigRepository systemConfigRepository;
    private final AiApiUsageLogRepository aiApiUsageLogRepository;
    private final UserAccountRepository userAccountRepository;
    private final MajorRepository majorRepository;
    private final SpecializationRepository specializationRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final CrawlBatchRepository crawlBatchRepository;
    private final TrendingWeightProposalRepository trendingWeightProposalRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SystemConfigResponse> getAllConfigs() {
        return systemConfigRepository.findAll().stream()
                .map(config -> SystemConfigResponse.builder()
                        .configKey(config.getConfigKey())
                        .configValue(config.getConfigValue())
                        .description(config.getDescription())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateConfigs(SystemConfigUpdateRequest request) {
        if (request.getConfigs() == null) return;

        // L2_LAYER1_DEF_14: validate CA lo truoc khi ghi bat ky dong nao — tranh
        // ghi nua chung (vai key hop le da luu, key sau moi phat hien loi).
        for (SystemConfigUpdateRequest.Entry entry : request.getConfigs()) {
            Predicate<String> validator = CONFIG_KEY_WHITELIST.get(entry.getConfigKey());
            if (validator == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Config key không hợp lệ: " + entry.getConfigKey());
            }
            if (!validator.test(entry.getConfigValue())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Giá trị không hợp lệ cho config key " + entry.getConfigKey() + ": "
                                + entry.getConfigValue());
            }
        }

        for (SystemConfigUpdateRequest.Entry entry : request.getConfigs()) {
            Optional<SystemConfig> existingOpt = systemConfigRepository.findByConfigKey(entry.getConfigKey());
            if (existingOpt.isPresent()) {
                SystemConfig existing = existingOpt.get();
                existing.setConfigValue(entry.getConfigValue());
                systemConfigRepository.save(existing);
            } else {
                SystemConfig newConfig = SystemConfig.builder()
                        .configKey(entry.getConfigKey())
                        .configValue(entry.getConfigValue())
                        .build();
                systemConfigRepository.save(newConfig);
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public AiUsageStatsResponse getAiUsageStats() {
        LocalDateTime since = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
        Long totalTokensObj = aiApiUsageLogRepository.sumTokenCountSince(AI_PROVIDER_GEMINI, since);
        long totalTokens = totalTokensObj != null ? totalTokensObj : 0;

        List<Object[]> purposeStats = aiApiUsageLogRepository.sumTokenByPurposeSince(AI_PROVIDER_GEMINI, since);
        Map<String, Long> tokensByPurpose = new HashMap<>();
        for (Object[] row : purposeStats) {
            String purpose = (String) row[0];
            Long count = (Long) row[1];
            tokensByPurpose.put(purpose, count != null ? count : 0);
        }

        return AiUsageStatsResponse.builder()
                .totalTokens(totalTokens)
                .quotaTokens(getMonthlyTokenQuota())
                .tokensByPurpose(tokensByPurpose)
                .since(since)
                .monthlyUsage(getMonthlyTokenUsage())
                .build();
    }

    /**
     * Hạn mức token mỗi tháng. Đọc từ system config để Admin đổi được mà không
     * phải build lại; giá trị hỏng hoặc thiếu thì lùi về mặc định.
     */
    private long getMonthlyTokenQuota() {
        return systemConfigRepository.findByConfigKey(AI_TOKEN_QUOTA_KEY)
                .map(SystemConfig::getConfigValue)
                .map(value -> {
                    try {
                        return Long.parseLong(value.trim());
                    } catch (NumberFormatException ex) {
                        return DEFAULT_MONTHLY_TOKEN_QUOTA;
                    }
                })
                .filter(quota -> quota > 0)
                .orElse(DEFAULT_MONTHLY_TOKEN_QUOTA);
    }

    /**
     * Mức tiêu thụ token của {@value #TRACKED_MONTHS} tháng gần nhất, cũ → mới.
     * Tháng không có log vẫn trả về với tokens = 0 để biểu đồ không bị khuyết cột.
     */
    private List<AiUsageStatsResponse.MonthlyTokenUsage> getMonthlyTokenUsage() {
        YearMonth currentMonth = YearMonth.now();
        YearMonth firstMonth = currentMonth.minusMonths(TRACKED_MONTHS - 1L);

        Map<YearMonth, Long> tokensByMonth = new HashMap<>();
        for (Object[] row : aiApiUsageLogRepository.sumTokenByMonthSince(AI_PROVIDER_GEMINI, firstMonth.atDay(1).atStartOfDay())) {
            YearMonth month = YearMonth.of(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
            Long tokens = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            tokensByMonth.put(month, tokens);
        }

        List<AiUsageStatsResponse.MonthlyTokenUsage> monthlyUsage = new ArrayList<>(TRACKED_MONTHS);
        for (int i = 0; i < TRACKED_MONTHS; i++) {
            YearMonth month = firstMonth.plusMonths(i);
            monthlyUsage.add(AiUsageStatsResponse.MonthlyTokenUsage.builder()
                    .year(month.getYear())
                    .month(month.getMonthValue())
                    .label(String.format("%02d/%d", month.getMonthValue(), month.getYear()))
                    .tokens(tokensByMonth.getOrDefault(month, 0L))
                    .build());
        }
        return monthlyUsage;
    }

    @Override
    @Transactional(readOnly = true)
    public SystemStatsResponse getSystemStats() {
        // Users by Role
        List<Object[]> roleStats = userAccountRepository.countByRoleGrouped();
        Map<String, Long> usersByRole = new HashMap<>();
        for (Object[] row : roleStats) {
            usersByRole.put((String) row[0], (Long) row[1]);
        }

        // Users by Status
        List<Object[]> statusStats = userAccountRepository.countByStatusGrouped();
        Map<String, Long> usersByStatus = new HashMap<>();
        for (Object[] row : statusStats) {
            usersByStatus.put((String) row[0], (Long) row[1]);
        }

        // Majors
        long totalMajorsActive = majorRepository.countByIsActiveTrue();
        
        // Specs
        long totalSpecsActive = specializationRepository.countByIsActiveTrue();
        
        // Narrow Specs
        long totalNarrowSpecsPublished = narrowSpecRepository.countByIsPublishedTrue();

        // Crawl Batch
        Optional<CrawlBatch> lastBatchOpt = crawlBatchRepository.findFirstByOrderByStartedAtDesc();
        String lastCrawlBatchStatus = null;
        LocalDateTime lastCrawlFinishedAt = null;
        if (lastBatchOpt.isPresent()) {
            lastCrawlBatchStatus = lastBatchOpt.get().getStatus();
        }
        Optional<CrawlBatch> lastSuccessBatchOpt = crawlBatchRepository.findFirstByStatusInOrderByStartedAtDesc(
                List.of("SUCCESS", "PARTIAL_SUCCESS"));
        if (lastSuccessBatchOpt.isPresent()) {
            lastCrawlFinishedAt = lastSuccessBatchOpt.get().getFinishedAt();
        } else if (lastBatchOpt.isPresent()) {
            lastCrawlFinishedAt = lastBatchOpt.get().getFinishedAt();
        }

        long totalStudents = usersByRole.getOrDefault("ROLE_STUDENT", usersByRole.getOrDefault("STUDENT", 0L));

        // Real TW Proposals count from database
        long pendingTwProposals = trendingWeightProposalRepository.findByStatus(TrendingWeightProposalStatus.PENDING).size();
        long approvedTwProposals = trendingWeightProposalRepository.findByStatus(TrendingWeightProposalStatus.ACCEPTED).size();
        long rejectedTwProposals = trendingWeightProposalRepository.findByStatus(TrendingWeightProposalStatus.REJECTED).size();
        long totalTwProposals = trendingWeightProposalRepository.count();

        // AI Tokens this month
        LocalDateTime since = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
        Long totalTokensObj = aiApiUsageLogRepository.sumTokenCountSince(AI_PROVIDER_GEMINI, since);
        long aiTokensThisMonth = totalTokensObj != null ? totalTokensObj : 0;

        return SystemStatsResponse.builder()
                .usersByRole(usersByRole)
                .usersByStatus(usersByStatus)
                .totalMajorsActive(totalMajorsActive)
                .totalSpecsActive(totalSpecsActive)
                .totalNarrowSpecsPublished(totalNarrowSpecsPublished)
                .lastCrawlBatchStatus(lastCrawlBatchStatus)
                .lastCrawlFinishedAt(lastCrawlFinishedAt)
                .pendingTwProposals(pendingTwProposals)
                .approvedTwProposals(approvedTwProposals)
                .rejectedTwProposals(rejectedTwProposals)
                .totalTwProposals(totalTwProposals)
                .totalStudents(totalStudents)
                .aiTokensThisMonth(aiTokensThisMonth)
                .build();
    }
}
