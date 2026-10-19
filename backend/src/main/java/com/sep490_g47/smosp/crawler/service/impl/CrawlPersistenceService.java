package com.sep490_g47.smosp.crawler.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.common.exception.CrawlerBusinessException;
import com.sep490_g47.smosp.crawler.adapter.VietnamWorksAdapter;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.entity.CrawlerSource;
import com.sep490_g47.smosp.crawler.entity.JobNormalizeTracking;
import com.sep490_g47.smosp.crawler.entity.RawJob;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.CrawlerSourceRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.repository.RawJobRepository;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Các bước ghi DB của pipeline crawl, mỗi bước là 1 transaction NGẮN riêng biệt.
 *
 * Bắt buộc tách thành bean riêng thay vì để chung method trong CrawlServiceImpl:
 * CrawlServiceImpl gọi sang đây qua Spring proxy nên @Transactional mới có hiệu
 * lực — nếu để chung 1 class thì self-invocation sẽ bỏ qua toàn bộ annotation.
 * Cùng lý do với {@link NormalizeItemProcessor}.
 *
 * Điểm mấu chốt: KHÔNG method nào ở đây bọc quanh lời gọi HTTP tới VietnamWorks.
 * DB connection chỉ bị giữ đúng lúc ghi (vài chục ms mỗi trang) thay vì suốt
 * 20-30 phút của cả phiên crawl như trước.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CrawlPersistenceService {

    /**
     * Sau ngần này phút mà một crawl_batch vẫn RUNNING thì coi như thread xử lý nó
     * đã chết mang theo trạng thái, không phải đang cào dở.
     *
     * Phải LỚN HƠN thời gian một phiên cào thật (đo được ~20-30 phút cho Chuyên
     * ngành nhiều tin) — đóng nhầm một phiên đang chạy thì lần cào chồng lên sẽ ghi
     * trùng dữ liệu. 120 phút cho biên an toàn gấp 4 lần, và trùng ngưỡng
     * OrphanTrackingSweeper đang dùng để nhận biết "còn đợt nào đang chạy".
     */
    @org.springframework.beans.factory.annotation.Value("${smosp.crawler.stale-batch-minutes:120}")
    private int staleBatchMinutes;

    /**
     * BR-38/BV-40a: sau ngần này lượt FAILED liên tiếp trên cùng một CrawlerSource
     * thì gửi CẢNH BÁO THƯỜNG cho Admin. Chỉ cảnh báo — không tắt nguồn.
     *
     * Hằng số cứng, không đọc qua system_config: whitelist ghi system_config đang
     * bị chặn ở một defect khác (L2_LAYER1_DEF_14) chờ BA, thêm key mới vào đó lúc
     * này sẽ mở lại đúng vấn đề đang tránh.
     */
    private static final int CONSECUTIVE_FAILURE_THRESHOLD = 3;

    /**
     * BR-38/BV-40b: chuỗi FAILED kéo dài liên tục ngần này ngày (tính từ
     * {@code firstFailureAt}, về null mỗi lượt SUCCESS/PARTIAL_SUCCESS) thì mới TỰ
     * TẮT nguồn kèm cảnh báo KHẨN CẤP.
     *
     * F-FE14-5 — trước đây không tồn tại vế này: cả cảnh báo lẫn auto-disable đều
     * treo chung vào {@link #CONSECUTIVE_FAILURE_THRESHOLD}, nên nguồn bị tắt ngay
     * ở lượt fail thứ 3 dù chuỗi đó có thể chỉ dài vài phút.
     *
     * GIỚI HẠN CÒN LẠI (cần nêu khi nghiệm thu, đừng coi BV-40b đã xong trọn):
     * mốc 7 ngày chỉ được ĐÁNH GIÁ khi có thêm một lượt fail mới. Nguồn hỏng rồi
     * không ai chạy lại thì không tự tắt đúng ngày thứ 7 — muốn vậy phải có job
     * quét định kỳ, gắn với hạ tầng Scheduler đọc {@code schedule_cron} hiện chưa
     * có (đã cắt phạm vi ở DEF_15).
     */
    private static final int STALE_FAILURE_DAYS = 7;

    private final CrawlerSourceRepository crawlerSourceRepository;
    private final CrawlBatchRepository crawlBatchRepository;
    private final RawJobRepository rawJobRepository;
    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final SpecializationRepository specializationRepository;
    private final UserAccountRepository userAccountRepository;
    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;
    private final RawJobContentHash rawJobContentHash;

    /** Thông tin cần để chạy crawl, đọc 1 lần rồi thoát transaction. */
    public record CrawlPlan(
            UUID specializationId,
            UUID sourceId,
            List<VietnamWorksAdapter.VietnamWorksCategoryGroup> categoryGroups
    ) {}

    /**
     * Validate + tạo batch RUNNING. Chạy đồng bộ trên request thread nên CM nhận
     * được lỗi cấu hình (chưa map category, nguồn bị tắt...) ngay lập tức thay vì
     * phải poll batch mới biết.
     */
    @Transactional
    public CrawlBatch createRunningBatch(UUID specializationId, String username) {
        Specialization spec = specializationRepository.findById(specializationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));

        // Chặn theo từng Specialization chứ không chặn toàn cục: /run-all cần chạy
        // song song nhiều spec, nhưng vẫn không cho crawl trùng đúng 1 spec 2 lần.
        //
        // CÓ NGƯỠNG THỜI GIAN. Bản cũ hỏi exists("RUNNING", spec) trần, không biết
        // batch bắt đầu từ bao giờ — nên một batch kẹt RUNNING (thread cào chết vì
        // Error mà không ai chốt trạng thái, hoặc server tắt giữa chừng) là chặn
        // VĨNH VIỄN mọi lần cào sau của đúng Chuyên ngành đó, cho tới khi có người
        // restart server hoặc sửa tay DB. Đó chính là kiểu treo "cào xong rồi không
        // thu thập được nữa".
        //
        // Batch quá hạn thì tự đóng ngay tại đây rồi cho lần cào mới đi tiếp: guard
        // tự gỡ được kẹt thay vì chờ người can thiệp.
        closeStaleRunningBatches(specializationId, spec.getCode());
        if (crawlBatchRepository.existsByStatusAndScopeSpecialization_Id("RUNNING", specializationId)) {
            throw new CrawlerBusinessException(
                    "Specialization " + spec.getCode() + " đang có phiên crawl chạy dở");
        }

        if (spec.getVietnamworksCategoryIds() == null || spec.getVietnamworksCategoryIds().trim().isEmpty()) {
            throw new CrawlerBusinessException("Specialization " + spec.getCode() + " chưa cấu hình category crawl");
        }

        // Parse sớm để lỗi JSON cấu hình bật ra ngay ở request, không phải 20 phút sau.
        parseCategoryGroups(spec);

        UserAccount user = userAccountRepository.findByUsername(username)
                .orElseGet(() -> userAccountRepository.findByEmail(username).orElse(null));
        // Cho phép triggeredBy = null khi chạy tự động (scheduler). Khi đó username
        // là chuỗi hệ thống ("scheduler") không khớp với bất kỳ tài khoản nào trong DB.
        // triggeredBy nullable ở DB nên không vi phạm constraint.
        if (user == null && !"scheduler".equals(username)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found");
        }

        CrawlerSource source = crawlerSourceRepository.findByAdapterKey("vietnamworks")
                .orElseThrow(() -> new RuntimeException("Crawler source 'vietnamworks' not found"));

        if (source.getIsEnabled() != null && !source.getIsEnabled()) {
            throw new CrawlerBusinessException(
                    "Nguồn crawl " + source.getName() + " đang bị tắt, vui lòng bật lại trước khi chạy");
        }

        return crawlBatchRepository.save(CrawlBatch.builder()
                .source(source)
                .status("RUNNING")
                .scopeSpecialization(spec)
                .triggeredBy(user)
                .startedAt(LocalDateTime.now())
                .build());
    }

    /**
     * Đóng các batch RUNNING của một Chuyên ngành đã quá hạn — tự gỡ kẹt cho guard.
     *
     * Chạy TRONG transaction của {@code createRunningBatch}, ngay trước khi guard
     * kiểm tra. Nghĩa là chính người bấm cào lại là người dọn xác batch cũ, không
     * phải chờ một vòng quét nền hay chờ restart server.
     *
     * KHÔNG đụng batch mới bắt đầu: một phiên cào thật kéo dài hàng chục phút, đóng
     * nhầm nó sẽ khiến hai phiên cùng ghi vào một Chuyên ngành.
     */
    private void closeStaleRunningBatches(UUID specializationId, String specCode) {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(staleBatchMinutes);

        List<CrawlBatch> running =
                crawlBatchRepository.findByStatusAndScopeSpecialization_Id("RUNNING", specializationId);

        for (CrawlBatch batch : running) {
            if (batch.getStartedAt() == null || batch.getStartedAt().isAfter(cutoff)) {
                continue; // còn trong hạn — coi như đang cào thật, để yên
            }
            batch.setStatus("FAILED");
            batch.setFinishedAt(LocalDateTime.now());
            batch.setErrorLog("Batch treo quá " + staleBatchMinutes
                    + " phút ở RUNNING (bắt đầu lúc " + batch.getStartedAt()
                    + ") — tự đóng khi có yêu cầu cào mới cho Chuyên ngành " + specCode);
            crawlBatchRepository.save(batch);
            log.warn("[crawl-guard] Tự đóng batch treo {} của {} (bắt đầu {}) → FAILED, cho phép cào lại",
                    batch.getId(), specCode, batch.getStartedAt());
        }
    }

    /**
     * Có ai xin dừng phiên này chưa — gọi giữa mỗi trang crawl.
     *
     * Batch biến mất giữa chừng (bị xoá tay) coi như xin dừng: không còn gì để ghi
     * vào thì cào tiếp cũng vô nghĩa.
     */
    @Transactional(readOnly = true)
    public boolean isCancelRequested(UUID batchId) {
        return crawlBatchRepository.findCancelRequestedById(batchId).orElse(true);
    }

    @Transactional(readOnly = true)
    public CrawlPlan loadPlan(UUID batchId) {
        CrawlBatch batch = crawlBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalStateException("Batch not found: " + batchId));
        Specialization spec = batch.getScopeSpecialization();
        if (spec == null) {
            throw new IllegalStateException("Batch " + batchId + " không gắn Specialization nào");
        }
        return new CrawlPlan(spec.getId(), batch.getSource().getId(), parseCategoryGroups(spec));
    }

    /**
     * Ghi 1 trang crawl. Đây là transaction dài nhất trong pipeline và nó chỉ kéo
     * dài đúng bằng thời gian insert ~50 job — connection trả về pool ngay sau đó.
     *
     * @return số tracking mới tạo hoặc được reset về PENDING, để cộng dồn vào total_parsed
     */
    @Transactional
    public int persistPage(UUID batchId, UUID specializationId, List<VietnamWorksAdapter.RawJobData> pageJobs,
                           Integer totalExpected, int totalFetchedSoFar) {
        if (pageJobs.isEmpty()) {
            // Vẫn ghi total_expected của trang đầu để client có mẫu số tính % ngay.
            saveProgress(batchId, totalExpected, totalFetchedSoFar, 0);
            return 0;
        }
        CrawlBatch batch = crawlBatchRepository.getReferenceById(batchId);
        Specialization spec = specializationRepository.getReferenceById(specializationId);

        int newOrResetTrackings = 0;
        for (VietnamWorksAdapter.RawJobData data : pageJobs) {
            Optional<RawJob> existingOpt = rawJobRepository.findByExternalId(data.getExternalId());

            String newHash = rawJobContentHash.of(data.getRawPayloadJson());

            RawJob rawJob;
            if (existingOpt.isEmpty()) {
                rawJob = rawJobRepository.save(RawJob.builder()
                        .batch(batch)
                        .externalId(data.getExternalId())
                        .titleRaw(data.getTitleRaw())
                        .rawPayload(data.getRawPayloadJson())
                        .contentHash(newHash)
                        .normalizeStatus("PENDING")
                        .build());
            } else {
                rawJob = existingOpt.get();

                // So DẤU VÂN TAY của những trường normalize thật sự đọc, không so cả
                // chuỗi JSON 106 trường như trước.
                //
                // Bản cũ coi 89% tin là "đã đổi" chỉ vì numOfApplications,
                // prettyApprovedOn, lastSyncedOn, priorityOrder… đổi mỗi lần fetch.
                // Mỗi lần đó resetToPendingByRawJobId đá tracking của MỌI Specialization
                // dùng chung tin đó về PENDING (trung bình 3,32 ngành). Ngành đã
                // normalize xong thì không còn sự kiện nào chạy lại → tracking mồ côi,
                // UI quay mãi. Đó là nguyên nhân 42 dòng kẹt trong phiên /run-all.
                String oldHash = rawJob.getContentHash() != null
                        ? rawJob.getContentHash()
                        : rawJobContentHash.of(rawJob.getRawPayload());

                // Không tính được hash (payload hỏng) thì lùi về so chuỗi thô — thà
                // normalize thừa còn hơn bỏ sót một tin thật sự đổi.
                boolean contentChanged = (newHash == null || oldHash == null)
                        ? !Objects.equals(rawJob.getRawPayload(), data.getRawPayloadJson())
                        : !newHash.equals(oldHash);

                if (contentChanged) {
                    rawJob.setTitleRaw(data.getTitleRaw());
                    rawJob.setRawPayload(data.getRawPayloadJson());
                    rawJob.setContentHash(newHash);
                    rawJobRepository.save(rawJob);
                    // Job đã refresh nội dung — mọi Specialization từng normalize job này
                    // cần xét lại từ đầu (bắt được posted_date/skill mới).
                    newOrResetTrackings += jobNormalizeTrackingRepository.resetToPendingByRawJobId(rawJob.getId());
                } else if (rawJob.getContentHash() == null && newHash != null) {
                    // Bản ghi cũ chưa có hash: ghi bù, KHÔNG reset tracking. Nếu coi
                    // "thiếu hash" là "đã đổi" thì lần crawl đầu sau khi deploy sẽ
                    // reset toàn bộ ~5.400 tin × 3,32 ngành cùng lúc.
                    rawJob.setContentHash(newHash);
                    rawJobRepository.save(rawJob);
                }
            }

            boolean trackingExists = jobNormalizeTrackingRepository
                    .findByRawJob_IdAndSpecialization_Id(rawJob.getId(), specializationId)
                    .isPresent();
            if (!trackingExists) {
                jobNormalizeTrackingRepository.save(JobNormalizeTracking.builder()
                        .rawJob(rawJob)
                        .specialization(spec)
                        .status("PENDING")
                        .build());
                newOrResetTrackings++;
            }
        }

        // Cập nhật tiến độ ngay trong cùng transaction ngắn của trang này — nếu chỉ
        // ghi ở finishBatch thì mọi con số đứng im ở 0 suốt 20-30 phút và client
        // không có gì để vẽ % tiến độ.
        batch.setTotalFetched(totalFetchedSoFar);
        batch.setTotalParsed((batch.getTotalParsed() == null ? 0 : batch.getTotalParsed()) + newOrResetTrackings);
        if (totalExpected != null) {
            batch.setTotalExpected(totalExpected);
        }
        crawlBatchRepository.save(batch);

        return newOrResetTrackings;
    }

    /** Ghi tiến độ khi trang không có job nào để ghi (vd trang đầu rỗng nhưng có meta). */
    @Transactional
    public void saveProgress(UUID batchId, Integer totalExpected, int totalFetched, int parsedDelta) {
        crawlBatchRepository.findById(batchId).ifPresent(batch -> {
            if (totalExpected != null) {
                batch.setTotalExpected(totalExpected);
            }
            batch.setTotalFetched(totalFetched);
            if (parsedDelta != 0) {
                batch.setTotalParsed((batch.getTotalParsed() == null ? 0 : batch.getTotalParsed()) + parsedDelta);
            }
            crawlBatchRepository.save(batch);
        });
    }

    /** @return status cuối đã ghi — bên gọi dựa vào đây để quyết định có nối sang normalize không. */
    @Transactional
    public String finishBatch(UUID batchId, UUID sourceId, int totalFetched, int totalParsed,
                            List<VietnamWorksAdapter.CrawlError> errors, Integer totalExpected) {
        return finishBatch(batchId, sourceId, totalFetched, totalParsed, errors, totalExpected, false);
    }

    @Transactional
    public String finishBatch(UUID batchId, UUID sourceId, int totalFetched, int totalParsed,
                            List<VietnamWorksAdapter.CrawlError> errors, Integer totalExpected,
                            boolean cancelled) {
        CrawlBatch batch = crawlBatchRepository.findById(batchId)
                .orElseThrow(() -> new IllegalStateException("Batch not found: " + batchId));

        // BV-37 bien duoi: 0 listing la INVALID bat ke co exception nao duoc nem
        // hay khong. Dieu kien cu doi CA HAI dieu kien (totalFetched==0 VA errors
        // khong rong) nen bo lot dung 2 kich ban nguy hiem nhat: doi ten field
        // "data" bi @JsonIgnoreProperties(ignoreUnknown=true) nuot lang le ->
        // getData()==null -> break (khong nem, khong ghi error); hoac doi ten
        // "nbPages" -> int nguyen thuy ve 0 -> maxPagesToCrawl=0 -> vong lap khong
        // chay lan nao. Ca hai deu ra totalFetched=0 VOI errors RONG, roi vao
        // nhanh else ben duoi va duoc bao SUCCESS voi 0 job — tin hieu "fail"
        // khong dang tin dung luc can no keu nhat.
        // Huỷ chủ động phải xét TRƯỚC mọi nhánh khác. Người dùng bấm dừng ngay khi
        // vừa chạy, totalFetched còn 0 — rơi vào nhánh FAILED bên dưới thì sẽ cộng
        // vào bộ đếm thất bại liên tiếp của nguồn (BR-38/BV-40a) và đủ 3 lần là tự
        // TẮT nguồn crawl, trong khi nguồn không hề có vấn đề gì.
        String status;
        if (cancelled) {
            status = "CANCELLED";
        } else if (totalFetched == 0) {
            status = "FAILED";
        } else if (!errors.isEmpty()) {
            status = "PARTIAL_SUCCESS";
        } else {
            status = "SUCCESS";
        }

        batch.setStatus(status);
        batch.setTotalFetched(totalFetched);
        batch.setTotalParsed(totalParsed);
        batch.setTotalErrors(errors.size());
        batch.setFinishedAt(LocalDateTime.now());
        if (totalExpected != null) {
            batch.setTotalExpected(totalExpected);
        }
        if (!errors.isEmpty()) {
            batch.setErrorLog(writeErrorLog(errors));
        }
        crawlBatchRepository.save(batch);

        LocalDateTime now = LocalDateTime.now();
        if ("CANCELLED".equals(status)) {
            // TRUNG TINH: khong recordSuccess, cung khong recordFailure.
            //
            // Nguoi dung bam dung khong noi len dieu gi ve suc khoe cua nguon, nen
            // khong duoc dong vao chuoi that bai lien tiep theo BAT KY chieu nao.
            // Goi recordSuccess() se XOA chuoi fail dang tich luy that — chi can bam
            // chay roi bam dung la reset duoc bo dem, vo hieu hoa luon co che tu tat
            // nguon hong o BR-38/BV-40a.
            log.info("[crawl] Batch {} bi dung theo yeu cau — khong tinh vao bo dem cua nguon", batchId);
        } else if (!"FAILED".equals(status)) {
            crawlerSourceRepository.findById(sourceId).ifPresent(source -> {
                source.setLastRunAt(now);
                crawlerSourceRepository.save(source);
            });
            // BR-38/BV-40a: SUCCESS lan PARTIAL_SUCCESS deu la tin hieu nguon con
            // song — PARTIAL_SUCCESS van la du lieu THAT duoc lay ve (vd mot phan
            // bi cham tran an toan BV-37, xem finishBatch phia tren), khong dang
            // tinh vao chuoi that bai lien tiep.
            crawlerSourceRepository.recordSuccess(sourceId, now);
        } else {
            LocalDateTime staleCutoff = now.minusDays(STALE_FAILURE_DAYS);
            crawlerSourceRepository.recordFailureAndMaybeDisable(sourceId, now, staleCutoff);
            alertAdminsIfThresholdReached(sourceId, staleCutoff,
                    "Batch " + batchId + " (finishBatch) — totalFetched=0");
        }

        return status;
    }

    /**
     * L2_LAYER3_DEF_03/AC-11-04 + F-FE14-5/BR-38 — hai mức cảnh báo TÁCH RỜI, đúng
     * như BV-40a/b mô tả:
     *
     * <ul>
     *   <li>{@code >= CONSECUTIVE_FAILURE_THRESHOLD} lượt fail liên tiếp (BV-40a):
     *       cảnh báo THƯỜNG, nguồn vẫn chạy tiếp.</li>
     *   <li>Chuỗi fail đã kéo dài quá {@code staleCutoff} (BV-40b): cảnh báo KHẨN
     *       CẤP, nguồn đã bị câu UPDATE ở
     *       {@code recordFailureAndMaybeDisable} tự tắt.</li>
     * </ul>
     *
     * Mức khẩn cấp NUỐT mức thường thay vì gửi cả hai: cùng một lượt fail sinh hai
     * thông báo về cùng một sự việc chỉ làm loãng cái nghiêm trọng hơn.
     *
     * Điều kiện "quá 7 ngày" ở đây tính lại từ {@code firstFailureAt} với ĐÚNG mốc
     * {@code staleCutoff} mà câu UPDATE vừa dùng (bên gọi truyền xuống, không tự
     * lấy {@code now} mới) — nếu hai nơi lấy hai mốc lệch nhau vài mili-giây thì có
     * lượt fail vừa đúng biên sẽ bị tắt nguồn mà không có cảnh báo nào đi kèm, hoặc
     * ngược lại. Cố ý KHÔNG suy ra từ {@code isEnabled}: Admin tắt tay một nguồn
     * đang có batch chạy dở cũng cho ra {@code isEnabled=false}, đọc theo cờ đó sẽ
     * báo khẩn cấp oan.
     *
     * Đọc lại state SAU khi UPDATE nguyên tử đã commit — chấp nhận đọc hơi trễ vài
     * mili-giây so với thời điểm ghi thật (không phải nguồn sự thật của bộ đếm, chỉ
     * dùng để quyết định có gửi Notification hay không).
     *
     * NAC-11-02: KHÔNG dedupe — mỗi lần batch rơi vào FAILED sau khi đã chạm ngưỡng
     * vẫn gửi tiếp (lần thất bại thứ 4, thứ 5... vẫn phải báo), không chỉ gửi một
     * lần duy nhất lúc chạm mốc.
     */
    private void alertAdminsIfThresholdReached(UUID sourceId, LocalDateTime staleCutoff, String context) {
        CrawlerSource source = crawlerSourceRepository.findById(sourceId).orElse(null);
        if (source == null) {
            return;
        }

        int failures = source.getConsecutiveFailures() == null ? 0 : source.getConsecutiveFailures();
        boolean staleWindowExceeded = source.getFirstFailureAt() != null
                && !source.getFirstFailureAt().isAfter(staleCutoff);
        boolean consecutiveReached = failures >= CONSECUTIVE_FAILURE_THRESHOLD;

        if (!staleWindowExceeded && !consecutiveReached) {
            return;
        }

        List<UserAccount> admins = userAccountRepository.findByRole_NameAndStatus("ROLE_ADMIN", "ACTIVE");
        if (admins.isEmpty()) {
            log.warn("[crawler-alert] Nguon '{}' that bai {} lan lien tiep (tu {}) nhung khong co Admin ACTIVE nao de bao",
                    source.getName(), failures, source.getFirstFailureAt());
            return;
        }

        String type;
        String title;
        String body;
        if (staleWindowExceeded) {
            type = "CRAWLER_SOURCE_AUTO_DISABLED";
            title = "KHẨN CẤP: Nguồn crawl đã bị tự động tắt";
            body = "Nguồn crawl \"" + source.getName() + "\" thất bại liên tục từ "
                    + source.getFirstFailureAt() + " (quá " + STALE_FAILURE_DAYS + " ngày, "
                    + failures + " lượt) — hệ thống đã tự động TẮT nguồn. "
                    + "Cần kiểm tra và bật lại thủ công sau khi khắc phục. (" + context + ")";
        } else {
            type = "CRAWLER_SOURCE_FAILURE";
            title = "Nguồn crawl gặp sự cố liên tiếp";
            body = "Nguồn crawl \"" + source.getName() + "\" đã thất bại "
                    + failures + " lần liên tiếp. Nguồn vẫn đang bật; sẽ tự động tắt nếu tình trạng"
                    + " kéo dài quá " + STALE_FAILURE_DAYS + " ngày. (" + context + ")";
        }

        List<Notification> notifications = admins.stream()
                .map(admin -> Notification.builder()
                        .user(admin)
                        .type(type)
                        .title(title)
                        .body(body)
                        .metadata(Map.of(
                                "sourceId", sourceId.toString(),
                                "consecutiveFailures", String.valueOf(failures),
                                "firstFailureAt", String.valueOf(source.getFirstFailureAt())))
                        .isRead(false)
                        .build())
                .toList();
        notificationRepository.saveAll(notifications);
    }

    /**
     * Đóng batch ở trạng thái FAILED khi 1 mắt xích SAU bước crawl hỏng ở tầng service
     * (auto-normalize / auto trending-weight). Giữ nguyên các con số đã cào được, chỉ
     * ghi đè status + error_log để CM nhìn thấy batch hỏng thay vì tưởng đã xong.
     *
     * CỐ Ý KHÔNG tính vào chuỗi thất bại liên tiếp của CrawlerSource (khác với
     * finishBatch() và markBatchFailed() bên dưới). Nguồn gọi hàm này trộn nhiều
     * nguyên nhân không liên quan gì tới việc VietnamWorks có phản hồi hay không:
     * PipelineRecoveryRunner gọi khi SERVER RESTART giữa chừng — không phải dấu
     * hiệu nguồn hỏng; CrawlPipelineListener gọi khi bước NORMALIZE/TÍNH TW phía
     * sau lỗi — lúc đó crawl đã THÀNH CÔNG, lỗi nằm ở nơi khác trong hệ thống. Gộp
     * cả hai vào bộ đếm sẽ tạo tín hiệu giả, tự tắt một nguồn vẫn đang hoạt động
     * tốt — đúng loại lỗi BR-38/BV-40a sinh ra để tránh, không nên tái tạo nó.
     */
    @Transactional
    public void markPipelineFailed(UUID batchId, String reason) {
        crawlBatchRepository.findById(batchId).ifPresent(batch -> {
            batch.setStatus("FAILED");
            if (batch.getFinishedAt() == null) {
                batch.setFinishedAt(LocalDateTime.now());
            }
            batch.setErrorLog(writeErrorLog(List.of(new VietnamWorksAdapter.CrawlError(
                    -1, reason, LocalDateTime.now().toString()))));
            crawlBatchRepository.save(batch);
        });
    }

    /**
     * Batch chết giữa chừng — vẫn phải đóng trạng thái, nếu không guard RUNNING sẽ
     * kẹt vĩnh viễn.
     *
     * CÓ tính vào chuỗi thất bại liên tiếp: exception nổ tới tận đây nghĩa là lỗi
     * đã vượt qua try/catch theo từng trang trong VietnamWorksAdapter — nhiều khả
     * năng là sự cố tầng mạng/kết nối thật với nguồn, đúng thứ BR-38 muốn theo dõi.
     *
     * F-FE14-3/BR-41 — compensating rollback: mỗi trang trong persistPage() đã
     * tự commit riêng nên không thể rollback DB thật khi batch fail. Bù lại bằng
     * cách xoá phần dữ liệu MỚI do đúng batch này tạo ra (xem
     * {@link RawJobRepository#deleteByBatchId}). Dữ liệu của các RawJob đã tồn
     * tại từ trước — kể cả khi batch này vừa ghi đè payload/reset tracking của
     * chúng — KHÔNG bị đụng tới, vì đó không phải dữ liệu sinh ra bởi batch fail
     * này nên không có gì để rollback.
     */
    @Transactional
    public void markBatchFailed(UUID batchId, int totalFetched, int totalParsed, Exception cause) {
        crawlBatchRepository.findById(batchId).ifPresent(batch -> {
            int deletedTrackings = jobNormalizeTrackingRepository.deleteByRawJobBatchId(batchId);
            int deletedRawJobs = rawJobRepository.deleteByBatchId(batchId);
            if (deletedRawJobs > 0) {
                log.info("[crawl][BR-41] Batch {} FAILED — da don {} raw_job va {} tracking moi tao boi batch nay",
                        batchId, deletedRawJobs, deletedTrackings);
            }

            LocalDateTime failedAt = LocalDateTime.now();
            LocalDateTime staleCutoff = failedAt.minusDays(STALE_FAILURE_DAYS);

            batch.setStatus("FAILED");
            batch.setTotalFetched(totalFetched);
            batch.setTotalParsed(totalParsed);
            batch.setFinishedAt(failedAt);
            crawlerSourceRepository.recordFailureAndMaybeDisable(
                    batch.getSource().getId(), failedAt, staleCutoff);
            alertAdminsIfThresholdReached(batch.getSource().getId(), staleCutoff,
                    "Batch " + batchId + " (markBatchFailed) — " + cause.getMessage());
            batch.setErrorLog(writeErrorLog(List.of(new VietnamWorksAdapter.CrawlError(
                    -1,
                    cause.getMessage() != null ? cause.getMessage() : cause.toString(),
                    LocalDateTime.now().toString()))));
            crawlBatchRepository.save(batch);
        });
    }

    private List<VietnamWorksAdapter.VietnamWorksCategoryGroup> parseCategoryGroups(Specialization spec) {
        try {
            return objectMapper.readValue(
                    spec.getVietnamworksCategoryIds(),
                    new TypeReference<List<VietnamWorksAdapter.VietnamWorksCategoryGroup>>() {}
            );
        } catch (JsonProcessingException e) {
            throw new CrawlerBusinessException("Specialization " + spec.getCode()
                    + " có vietnamworksCategoryIds không đúng định dạng JSON: " + e.getMessage());
        }
    }

    private String writeErrorLog(List<VietnamWorksAdapter.CrawlError> errors) {
        try {
            return objectMapper.writeValueAsString(errors);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize error log", e);
            return null;
        }
    }
}
