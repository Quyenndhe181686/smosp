package com.sep490_g47.smosp.gemini.service.impl;

import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.admin.entity.AiApiUsageLog;
import com.sep490_g47.smosp.admin.repository.AiApiUsageLogRepository;
import com.sep490_g47.smosp.admin.service.SystemConfigReader;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.gemini.dto.AiConnectionTestResult;
import com.sep490_g47.smosp.gemini.dto.GeminiResponse;
import com.sep490_g47.smosp.gemini.service.GeminiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiServiceImpl implements GeminiService {

    /**
     * F-FE16-11 — API key CỐ Ý chỉ đọc từ biến môi trường / application.yml, KHÔNG
     * đọc từ system_config như endpoint và model.
     *
     * Lý do là bảo mật, không phải bỏ sót: GET /api/admin/system-config trả về
     * TOÀN BỘ bảng system_config kèm config_value nguyên văn. Đưa API key thật vào
     * bảng đó nghĩa là bất kỳ tài khoản ADMIN nào gọi một endpoint GET cũng đọc
     * được key, và key nằm không mã hoá trong DB lẫn mọi bản backup.
     *
     * Màn cấu hình AI chỉ gửi lên "ai_api_key_masked" (dạng ••••••••cdef) — giá trị
     * để HIỂN THỊ LẠI, không phải key dùng được. Muốn đổi key thật thì đổi biến môi
     * trường GEMINI_API_KEY rồi khởi động lại.
     */
    @Value("${gemini.api-key}")
    private String apiKey;

    // Fallback khi system_config chua co key (moi truong moi) — KHONG con la gia
    // tri that su dung. Xem effectiveModel() trong generateContent().
    @Value("${gemini.model}")
    private String defaultModel;

    /** Fallback khi system_config chưa có "ai_endpoint" — xem {@link #effectiveEndpoint()}. */
    @Value("${gemini.endpoint}")
    private String endpoint;

    private final AiApiUsageLogRepository aiApiUsageLogRepository;
    private final SystemConfigReader systemConfigReader;
    private final UserAccountRepository userAccountRepository;
    private final NotificationRepository notificationRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * CỐ Ý không có @Transactional: restTemplate.postForObject() gọi Gemini API, một
     * request generate có thể mất vài chục giây. Bọc transaction ở đây đồng nghĩa giữ
     * 1 DB connection suốt cả lời gọi AI — và nguy hiểm hơn, khi module recommendation
     * gọi method này bên trong một transaction tổng hợp lớn hơn thì transaction đó
     * cũng bị kéo dài theo. Việc ghi log usage đã có transaction ngắn riêng bên dưới.
     */
    @Override
    public GeminiResponse generateContent(String prompt, String purpose, UUID referenceId) {
        // BV-41 / DEF_28: bộ đếm token đã đủ (sumTokenCountSince đọc thật từ
        // ai_api_usage_log), nhưng trước đây không có nơi nào so nó với quota
        // trước khi gọi API — generateContent() là choke point DUY NHẤT (0 caller
        // khác ngoài package gemini/), nên chặn ở đây phủ được toàn bộ hệ thống.
        // Token AI là chi phí tiền thật; từ chối SỚM, không gọi postForObject(),
        // để không tốn thêm token của lượt vượt quota.
        LocalDateTime startOfMonth = LocalDateTime.now().toLocalDate().withDayOfMonth(1).atStartOfDay();
        long monthlyQuota = systemConfigReader.getInt("ai_monthly_token_quota", 1_000_000);
        // AC-56-02b: sumTokenCountSince nay loc theo provider. Truoc day khong loc
        // nen mot provider AI thu hai (neu them sau) se bi tinh chung token vao
        // quota cua Gemini.
        long usedThisMonth = Optional.ofNullable(aiApiUsageLogRepository.sumTokenCountSince("gemini", startOfMonth)).orElse(0L);

        if (usedThisMonth >= monthlyQuota) {
            log.warn("[BV-41] Da vuot quota token AI thang ({}/{}) — tu choi goi Gemini cho purpose={} referenceId={}",
                    usedThisMonth, monthlyQuota, purpose, referenceId);
            alertAdmins("AI_QUOTA_EXCEEDED", "Đã vượt quota token AI tháng",
                    "Quota token AI tháng đã dùng " + usedThisMonth + "/" + monthlyQuota
                            + ". Các yêu cầu AI mới đang bị từ chối (purpose=" + purpose + ").");
            return GeminiResponse.builder()
                    .text("[AI service unavailable]")
                    .tokenCount(0)
                    .build();
        }

        // L2_LAYER1_DEF_18 — truoc day model doc 1 lan luc startup qua @Value, Admin
        // doi "ai_model" tren man cau hinh he thong luu duoc, doc lai dung, nhung
        // KHONG bao gio anh huong request that (FT-56, 4/4 AC). Doc lai moi lan
        // goi, fallback ve default trong application.yml khi chua co key.
        String effectiveModel = systemConfigReader.getString("ai_model", defaultModel);

        // "ai_provider" duoc seed va hien tren man cau hinh nhung chi co 1 provider
        // (Gemini) duoc cai that trong he thong — khong co dispatch da-provider. Doc
        // lai o day de gia tri KHONG con la vo tri hoan toan: neu Admin dat khac
        // "gemini" thi canh bao ro thay vi im lang bo qua nhu truoc, nhung KHONG tu
        // y trien khai chuyen provider (thuoc pham vi rieng L2_LAYER2_DEF_02, can BA
        // quyet dinh thao/vo hieu man hay lam that da-provider).
        String configuredProvider = systemConfigReader.getString("ai_provider", "gemini");
        if (!"gemini".equalsIgnoreCase(configuredProvider)) {
            log.warn("[ai-config] system_config.ai_provider='{}' nhung chi co Gemini duoc cai — van dung Gemini.",
                    configuredProvider);
        }

        // Increase tokens
        // Created by: BaoTQ - 260813
        int maxOutputTokens = systemConfigReader.getInt("ai_max_tokens", 2000);

        String textResponse;
        int tokenCount;
        try {
            String url = generateContentUrl(effectiveEndpoint(), effectiveModel);

            Map<String, Object> requestBody = new HashMap<>();
            List<Map<String, Object>> contents = new ArrayList<>();
            Map<String, Object> contentMap = new HashMap<>();
            List<Map<String, Object>> parts = new ArrayList<>();
            Map<String, Object> textPart = new HashMap<>();

            textPart.put("text", prompt);
            parts.add(textPart);
            contentMap.put("parts", parts);
            contents.add(contentMap);
            requestBody.put("contents", contents);

            // Fix short script & confuse language
            // Created by: BaoTQ - 260813
            Map<String, Object> generationConfig = new HashMap<>();
            generationConfig.put("maxOutputTokens", maxOutputTokens);
            generationConfig.put("thinkingConfig", Map.of("thinkingBudget", 0));
            requestBody.put("generationConfig", generationConfig);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

            Map<String, Object> response = restTemplate.postForObject(url, requestEntity, Map.class);

            textResponse = extractText(response);
            tokenCount = extractTokenCount(response);

        } catch (Exception e) {
            log.error("Error calling Gemini API: {}", e.getMessage());
            alertAdmins("AI_CALL_FAILED", "Gọi Gemini API thất bại",
                    "Lời gọi Gemini API lỗi cho purpose=" + purpose + ": "
                            + (e.getMessage() != null ? e.getMessage() : e.toString()));
            return GeminiResponse.builder()
                    .text("[AI service unavailable]")
                    .tokenCount(0)
                    .build();
        }

        // Ngoài try của lời gọi API: usage log chỉ là số liệu phụ, ghi hỏng thì không
        // được phép vứt đi câu trả lời AI đã lấy về thành công (và đã tốn token).
        saveUsageLogQuietly(purpose, referenceId, tokenCount);

        return GeminiResponse.builder()
                .text(textResponse)
                .tokenCount(tokenCount)
                .build();
    }

    /**
     * F-FE16-11 — endpoint đọc lại từ system_config MỖI LẦN GỌI, cùng cơ chế với
     * {@code ai_model} (L2_LAYER1_DEF_18).
     *
     * Trước đây chỉ đọc một lần lúc khởi động qua {@code @Value}, nên Admin sửa
     * endpoint trên màn cấu hình thì lưu được, đọc lại đúng, mà request thật vẫn đi
     * tới địa chỉ cũ cho tới khi khởi động lại ứng dụng.
     *
     * Cắt dấu "/" thừa ở cuối: {@link #generateContentUrl} tự nối "/" nên endpoint
     * kết thúc bằng "/" sẽ tạo URL có "//" — Gemini trả 404 và Admin rất khó đoán
     * nguyên nhân chỉ từ thông báo lỗi.
     */
    private String effectiveEndpoint() {
        String configured = systemConfigReader.getString("ai_endpoint", endpoint);
        return configured == null ? null : configured.replaceAll("/+$", "");
    }

    private String generateContentUrl(String baseEndpoint, String model) {
        return baseEndpoint + "/" + model + ":generateContent?key=" + apiKey;
    }

    /**
     * Bỏ API key khỏi chuỗi trước khi đưa ra ngoài. BẮT BUỘC với mọi thông báo lỗi
     * lọt ra API response: RestTemplate nhét nguyên URL đã gọi vào message của
     * {@code ResourceAccessException}, mà URL Gemini mang API key trên query string
     * — trả thẳng ra là rò key cho client.
     */
    private static String redactApiKey(String raw) {
        if (raw == null) {
            return null;
        }
        return raw.replaceAll("(?i)key=[^&\\s\"']+", "key=***");
    }

    /**
     * AC-56-03 — gọi thử một request nhỏ nhất có thể tới đúng endpoint/model đang
     * cấu hình.
     *
     * CỐ Ý không đi qua {@link #generateContent}: chẩn đoán phải chạy được CẢ KHI
     * đã vượt quota tháng (đó chính là lúc Admin cần kiểm tra nhất), và không được
     * ghi vào ai_api_usage_log để khỏi làm bẩn số liệu tiêu thụ.
     *
     * Vẫn tốn một lượng token rất nhỏ vì đây là lời gọi thật — không có cách nào
     * kiểm tra "endpoint + key + model có dùng được không" mà không gọi thật.
     */
    @Override
    public AiConnectionTestResult testConnection() {
        String url = effectiveEndpoint();
        String model = systemConfigReader.getString("ai_model", defaultModel);
        long startedAt = System.currentTimeMillis();

        if (apiKey == null || apiKey.trim().isEmpty()) {
            return AiConnectionTestResult.builder()
                    .success(false)
                    .message("Chưa cấu hình API key (biến môi trường GEMINI_API_KEY).")
                    .endpoint(url)
                    .model(model)
                    .latencyMs(0)
                    .build();
        }

        try {
            Map<String, Object> requestBody = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", "ping")))),
                    "generationConfig", Map.of("maxOutputTokens", 1));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> response = restTemplate.postForObject(
                    generateContentUrl(url, model), new HttpEntity<>(requestBody, headers), Map.class);

            long latency = System.currentTimeMillis() - startedAt;
            boolean ok = response != null && response.containsKey("candidates");

            return AiConnectionTestResult.builder()
                    .success(ok)
                    .message(ok
                            ? "Kết nối thành công."
                            : "Gọi được tới endpoint nhưng phản hồi không đúng định dạng Gemini.")
                    .endpoint(url)
                    .model(model)
                    .latencyMs(latency)
                    .build();

        } catch (Exception e) {
            long latency = System.currentTimeMillis() - startedAt;
            String detail = redactApiKey(e.getMessage() != null ? e.getMessage() : e.toString());
            log.warn("[ai-config] Kiem tra ket noi AI that bai: {}", detail);
            return AiConnectionTestResult.builder()
                    .success(false)
                    .message("Không kết nối được: " + detail)
                    .endpoint(url)
                    .model(model)
                    .latencyMs(latency)
                    .build();
        }
    }

    /**
     * Lời gọi save() lẻ đã tự chạy trong transaction ngắn của Spring Data — chỉ kéo
     * dài đúng 1 câu INSERT, không dính gì tới thời gian chờ Gemini phía trên.
     */
    private void saveUsageLogQuietly(String purpose, UUID referenceId, int tokenCount) {
        try {
            aiApiUsageLogRepository.save(AiApiUsageLog.builder()
                    .provider("gemini")
                    .purpose(purpose)
                    .referenceId(referenceId)
                    .tokenCount(tokenCount)
                    .calledAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.error("Không ghi được ai_api_usage_log cho purpose={} referenceId={}", purpose, referenceId, e);
        }
    }

    /**
     * L2_LAYER3_DEF_03/AC-11-01/AC-11-02 — cảnh báo Admin khi AI lỗi hoặc hết
     * quota, thay vì chỉ nuốt thành fallback text như trước.
     *
     * NAC-11-02: KHÔNG dedupe theo thiết kế gốc — nhưng generateContent() có thể
     * bị gọi nhiều lần/phút bởi nhiều Student khác nhau (recommendation, roadmap
     * advice...), khác hẳn tần suất crawl (1 batch/Specialization/tuần). Gửi 1
     * Notification cho MỖI lần gọi lỗi khi đã mất kết nối AI diện rộng sẽ tạo
     * hàng trăm bản ghi trùng nội dung trong vài phút. Giữ đúng NAC-11-02 (không
     * lọc theo nội dung) nhưng lỗi ghi Notification không được phép làm hỏng
     * response AI đã có — bọc try/catch riêng, chỉ log nếu hỏng.
     */
    private void alertAdmins(String type, String title, String body) {
        try {
            List<UserAccount> admins = userAccountRepository.findByRole_NameAndStatus("ROLE_ADMIN", "ACTIVE");
            if (admins.isEmpty()) {
                log.warn("[ai-alert] {} nhung khong co Admin ACTIVE nao de bao: {}", type, body);
                return;
            }
            List<Notification> notifications = admins.stream()
                    .map(admin -> Notification.builder()
                            .user(admin)
                            .type(type)
                            .title(title)
                            .body(body)
                            .isRead(false)
                            .build())
                    .toList();
            notificationRepository.saveAll(notifications);
        } catch (Exception ex) {
            log.error("Không gửi được Notification cảnh báo AI (type={})", type, ex);
        }
    }

    // Created by: BaoTQ - 260813
    private String extractText(Map<String, Object> response) {
        try {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> candidate = candidates.get(0);
                Map<String, Object> content = (Map<String, Object>) candidate.get("content");
                if (content != null) {
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                    if (parts != null) {
                        // Bỏ qua các part có "thought": true — chỉ lấy phần trả lời thật.
                        for (Map<String, Object> part : parts) {
                            Boolean isThought = (Boolean) part.get("thought");
                            if (isThought == null || !isThought) {
                                Object text = part.get("text");
                                if (text != null) return (String) text;
                            }
                        }
                    }
                }
                // finishReason=MAX_TOKENS means that the response is cut off because the
                // budget is exhausted — log to know
                // need increasing maxOutputTokens, not API error.
                Object finishReason = candidate.get("finishReason");
                if ("MAX_TOKENS".equals(finishReason)) {
                    log.warn("[gemini] Response bi cat do het maxOutputTokens — can tang ai_max_tokens");
                }
            }
        } catch (Exception e) {
            log.warn("Could not extract text from Gemini response");
        }
        return "[AI service unavailable]";
    }

    private int extractTokenCount(Map<String, Object> response) {
        try {
            Map<String, Object> usageMetadata = (Map<String, Object>) response.get("usageMetadata");
            if (usageMetadata != null && usageMetadata.get("totalTokenCount") != null) {
                return (Integer) usageMetadata.get("totalTokenCount");
            }
        } catch (Exception e) {
            log.warn("Could not extract token count from Gemini response");
        }
        return 0;
    }
}
