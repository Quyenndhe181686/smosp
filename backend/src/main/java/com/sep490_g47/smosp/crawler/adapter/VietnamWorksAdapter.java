package com.sep490_g47.smosp.crawler.adapter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490_g47.smosp.admin.service.SystemConfigReader;
import com.sep490_g47.smosp.crawler.dto.response.VnwSearchResponse;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class VietnamWorksAdapter {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigReader systemConfigReader;

    private static final String API_URL = "https://ms.vietnamworks.com/job-search/v1.0/search";
    private static final int HITS_PER_PAGE = 50;

    /**
     * BV-37 — trần nghiệp vụ cứng: tối đa 10.000 listing mỗi batch. Trước đây
     * không có hằng số nào đặt tên cho con số này — trần THẬT chỉ là tích số học
     * ngầm {@code safetyCap × HITS_PER_PAGE}, và {@code safetyCap} đọc từ
     * {@code crawler_max_pages_safety_cap} mà Admin sửa tự do không kiểm miền.
     * Admin nâng lên "500" với thiện chí "lấy nhiều dữ liệu hơn" là trần thành
     * 25.000 — vượt BV-37 mà không màn hình nào cảnh báo, chạm đúng rủi ro BV-37
     * nêu (quá tải AI Pipeline, rate limit VietnamWorks).
     */
    private static final int MAX_LISTINGS_PER_BATCH = 10_000;

    // Nhóm category theo parentId thật của VNW taxonomy (vd parentId=5 "CNTT/Viễn
    // Thông", parentId=9 "Khoa Học & Kỹ Thuật") — 1 Specialization có thể cần
    // nhiều parentId cùng lúc (vd AS: vừa Kỹ Thuật Ô Tô ở parentId=9, vừa Phần
    // Mềm Máy Tính ở parentId=5).
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VietnamWorksCategoryGroup {
        private Integer parentId;
        private List<Integer> childrenIds;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    public static class CrawlError {
        private int page;
        private String error;
        private String timestamp;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    public static class CrawlSummary {
        private int totalFetched;
        private List<CrawlError> errors;
        // meta.nbHits của trang đầu — tổng số job nguồn báo có. null khi nguồn không
        // trả meta hoặc trang đầu lỗi.
        private Integer totalExpected;
        /**
         * Phiên dừng giữa chừng do có người bấm dừng, KHÔNG phải do lỗi.
         *
         * Bên gọi bắt buộc phải phân biệt: dừng chủ động mà chốt thành FAILED sẽ
         * cộng vào bộ đếm thất bại liên tiếp của nguồn và có thể tự tắt nguồn crawl
         * — trong khi nguồn hoàn toàn khoẻ mạnh.
         */
        private boolean cancelled;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    public static class RawJobData {
        private String externalId;
        private String titleRaw;
        private String rawPayloadJson;
    }

    /**
     * Nhận từng trang ngay khi crawl xong. Bên gọi chịu trách nhiệm ghi DB trong
     * transaction riêng của trang đó — adapter không biết gì về transaction.
     */
    @FunctionalInterface
    public interface PageHandler {
        /**
         * @param totalExpected tổng số job nguồn báo có, biết được từ trang đầu; null
         *        nếu nguồn không trả meta. Đẩy kèm mỗi trang để bên gọi ghi được tiến
         *        độ xuống DB ngay trong lúc crawl chứ không phải đợi hết phiên.
         */
        void handlePage(int page, List<RawJobData> jobs, Integer totalExpected);
    }

    /**
     * Hỏi bên gọi "có ai xin dừng phiên này chưa" — adapter gọi TRƯỚC mỗi trang.
     *
     * Adapter cố ý không biết gì về batch hay DB: nó chỉ hỏi một câu boolean, còn
     * việc cờ dừng nằm ở đâu là chuyện của tầng service.
     */
    @FunctionalInterface
    public interface CancellationCheck {
        boolean isCancelled();

        /** Dùng cho lời gọi không cần huỷ (test, hoặc luồng chạy một lần). */
        CancellationCheck NEVER = () -> false;
    }

    /**
     * Crawl tuần tự từng trang và đẩy ngay cho {@code pageHandler} thay vì gom cả
     * 200 trang vào RAM rồi mới ghi 1 lần: mỗi trang là 1 transaction insert ngắn,
     * crawl fail giữa chừng vẫn giữ được dữ liệu các trang đã xong.
     *
     * Method này KHÔNG được phép chạy trong transaction — nó có Thread.sleep(1000)
     * mỗi trang và block chờ HTTP, tức là sẽ giữ DB connection hàng chục phút.
     */
    public CrawlSummary fetchItJobs(List<VietnamWorksCategoryGroup> categoryGroups, PageHandler pageHandler) {
        return fetchItJobs(categoryGroups, pageHandler, CancellationCheck.NEVER);
    }

    public CrawlSummary fetchItJobs(List<VietnamWorksCategoryGroup> categoryGroups, PageHandler pageHandler,
                                    CancellationCheck cancellationCheck) {
        int totalFetched = 0;
        Integer totalExpected = null;
        boolean cancelled = false;
        List<CrawlError> errors = new ArrayList<>();

        // Chỗ này vốn đã có try/catch nên không sập, nhưng nó nuốt lỗi hoàn toàn im
        // lặng — config gõ nhầm thì crawler âm thầm chạy với trần 200 và không ai
        // biết. SystemConfigReader làm đúng việc đó nhưng có log WARN nêu đích danh
        // key và giá trị sai.
        int safetyCap = systemConfigReader.getInt("crawler_max_pages_safety_cap", 200);

        // BV-37: safetyCap chi duoc phep HA tran, khong duoc NANG vuot tran nghiep
        // vu. 200 (mac dinh) dung bang MAX_LISTINGS_PER_BATCH / HITS_PER_PAGE nen
        // hanh vi mac dinh khong doi; chi chan khi Admin dat gia tri lon hon.
        int maxAllowedPages = MAX_LISTINGS_PER_BATCH / HITS_PER_PAGE;
        if (safetyCap > maxAllowedPages) {
            log.warn("[BV-37] crawler_max_pages_safety_cap={} vuot tran nghiep vu {} trang (={} listing) — ep ve tran",
                    safetyCap, maxAllowedPages, MAX_LISTINGS_PER_BATCH);
            safetyCap = maxAllowedPages;
        }

        int maxPagesToCrawl = safetyCap;

        for (int page = 0; page < maxPagesToCrawl; page++) {
            // Điểm dừng hợp tác: kiểm TRƯỚC khi gọi HTTP trang tiếp theo, nên đã
            // bấm dừng thì không tốn thêm lượt gọi VietnamWorks nào nữa. Phần dữ
            // liệu các trang trước giữ nguyên vì mỗi trang đã ghi trong transaction
            // riêng của nó.
            if (cancellationCheck.isCancelled()) {
                cancelled = true;
                log.info("[crawl] Nhan yeu cau dung o trang {} — da lay {} job, thoat em", page, totalFetched);
                break;
            }

            try {
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("query", "");
                
                Map<String, Object> filterMap = new HashMap<>();
                filterMap.put("field", "jobFunction");
                
                List<Map<String, Object>> filterValueList = categoryGroups.stream()
                        .map(g -> Map.<String, Object>of("parentId", g.getParentId(), "childrenIds", g.getChildrenIds()))
                        .collect(Collectors.toList());
                filterMap.put("value", objectMapper.writeValueAsString(filterValueList));
                requestBody.put("filter", List.of(filterMap));
                
                requestBody.put("ranges", List.of());
                requestBody.put("order", List.of());
                requestBody.put("hitsPerPage", HITS_PER_PAGE);
                requestBody.put("page", page);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

                ResponseEntity<VnwSearchResponse> response = restTemplate.postForEntity(
                        API_URL,
                        entity,
                        VnwSearchResponse.class
                );

                VnwSearchResponse responseBody = response.getBody();
                if (responseBody == null || responseBody.getData() == null || responseBody.getData().isEmpty()) {
                    break;
                }

                if (page == 0 && responseBody.getMeta() != null) {
                    int apiTotalPages = responseBody.getMeta().getNbPages();
                    maxPagesToCrawl = Math.min(apiTotalPages, safetyCap);
                    int nbHits = responseBody.getMeta().getNbHits();
                    // nbHits = tổng số job thật của bộ filter. Nếu safety cap chặn bớt
                    // trang thì số job tối đa lấy được cũng bị chặn theo — lấy min để
                    // % tiến độ không đứng mãi dưới 100%.
                    //
                    // CỐ Ý giữ nguyên totalExpected bị chặn (không đổi thành nbHits
                    // thô): TC-UNIT-VietnamWorksAdapter-010 (đặc tả đã duyệt) khẳng
                    // định totalExpected PHẢI bị chặn — đổi ngữ nghĩa cột này cần BA
                    // chốt trước. Cái sửa được ngay mà không đụng ngữ nghĩa đó: khi
                    // việc chặn thật sự CẮT MẤT dữ liệu (nbHits > những gì lấy được),
                    // phát tín hiệu qua CrawlError để finishBatch() không còn báo
                    // SUCCESS 100% cho một mẻ đã bị cắt cụt.
                    int reachable = maxPagesToCrawl * HITS_PER_PAGE;
                    totalExpected = Math.min(nbHits, reachable);

                    if (nbHits > reachable) {
                        String truncatedMsg = "Cham tran an toan " + maxPagesToCrawl + " trang (nbHits that="
                                + nbHits + ", chi lay duoc toi da " + reachable + ") - me crawl bi cat cut";
                        log.warn("[BV-37] {}", truncatedMsg);
                        errors.add(new CrawlError(page, truncatedMsg, java.time.LocalDateTime.now().toString()));
                    }
                }

                List<RawJobData> pageJobs = new ArrayList<>();
                for (Map<String, Object> job : responseBody.getData()) {
                    String externalId = String.valueOf(job.get("jobId"));
                    String titleRaw = (String) job.get("jobTitle");
                    String rawPayloadJson = objectMapper.writeValueAsString(job);

                    pageJobs.add(new RawJobData(externalId, titleRaw, rawPayloadJson));
                }

                // Lỗi ghi DB của 1 trang cũng chỉ là lỗi của trang đó (ghi vào
                // errors ở catch bên dưới) — các trang sau vẫn crawl tiếp.
                pageHandler.handlePage(page, pageJobs, totalExpected);
                totalFetched += pageJobs.size();
            } catch (Exception e) {
                log.error("Error fetching VietnamWorks page {}", page, e);
                errors.add(new CrawlError(page, e.getMessage() != null ? e.getMessage() : e.toString(), java.time.LocalDateTime.now().toString()));
            }

            try {
                Thread.sleep(1000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.error("Crawl sleep interrupted", ie);
            }
        }

        return new CrawlSummary(totalFetched, errors, totalExpected, cancelled);
    }
}
