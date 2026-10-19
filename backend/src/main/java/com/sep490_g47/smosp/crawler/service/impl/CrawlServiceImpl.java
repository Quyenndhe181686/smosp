package com.sep490_g47.smosp.crawler.service.impl;

import com.sep490_g47.smosp.crawler.adapter.VietnamWorksAdapter;
import com.sep490_g47.smosp.crawler.dto.response.CrawlAllResponse;
import com.sep490_g47.smosp.crawler.dto.response.CrawlAllResultItem;
import com.sep490_g47.smosp.crawler.dto.response.CrawlBatchResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.common.exception.CrawlerBusinessException;
import com.sep490_g47.smosp.crawler.event.CrawlCompletedEvent;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.service.CrawlService;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Điều phối phiên crawl. CỐ Ý không có @Transactional ở bất kỳ method nào:
 * fetchItJobs() gọi HTTP + Thread.sleep(1000) cho tối đa 200 trang (20-30 phút),
 * nếu bọc transaction ở đây thì 1 DB connection bị giữ suốt cả quá trình đó và
 * pool (mặc định 10) cạn rất nhanh, làm mọi API khác timeout.
 *
 * Mọi thao tác ghi DB được ủy quyền sang {@link CrawlPersistenceService} — bean
 * riêng, gọi qua Spring proxy, mỗi lời gọi là 1 transaction ngắn tự commit.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CrawlServiceImpl implements CrawlService {

    private final VietnamWorksAdapter vietnamWorksAdapter;
    private final CrawlPersistenceService crawlPersistenceService;
    private final ApplicationEventPublisher eventPublisher;
    private final SpecializationRepository specializationRepository;
    private final CrawlBatchRepository crawlBatchRepository;
    private final UserAccountRepository userAccountRepository;
    private final NotificationRepository notificationRepository;
    private final CrawlBatchMapper crawlBatchMapper;

    /**
     * Tham chiếu tới CHÍNH BEAN NÀY qua proxy của Spring.
     *
     * BẮT BUỘC phải có: {@code runOne()} gọi {@code runCrawlAsync()}, mà gọi thẳng
     * trong cùng một class là self-invocation — Spring proxy bị bỏ qua và
     * {@code @Async} mất tác dụng hoàn toàn. Hậu quả không phải lỗi biên dịch mà là
     * cả phiên crawl 20-30 phút chạy đồng bộ trên thread HTTP của Tomcat: request
     * của CM treo tới khi timeout, và pool thread web cạn dần.
     *
     * Cùng loại bẫy mà {@link CrawlPersistenceService} đã phải tách hẳn thành bean
     * riêng để tránh, chỉ khác là ở đó cho {@code @Transactional}.
     *
     * {@code @Lazy} để cắt vòng phụ thuộc khi Spring dựng bean.
     */
    private final @org.springframework.context.annotation.Lazy CrawlService self;

    @Override
    public CrawlBatch prepareBatch(UUID specializationId, String username) {
        return crawlPersistenceService.createRunningBatch(specializationId, username);
    }

    /**
     * Tạo batch rồi đẩy vào hàng đợi cho một Chuyên ngành.
     *
     * {@code prepareBatch()} đã COMMIT một dòng RUNNING trước khi tới
     * {@code runCrawlAsync()}. Nếu bước đẩy hàng đợi ném lỗi (điển hình:
     * {@code RejectedExecutionException} khi hàng đợi crawlExecutor đầy) mà không
     * đóng batch lại thì không thread nào nhận việc, cũng không ai chốt trạng thái
     * — batch nằm RUNNING vĩnh viễn và guard
     * {@code existsByStatusAndScopeSpecialization_Id} chặn luôn lần cào sau của
     * chính Chuyên ngành đó. Đây đúng là lỗi đã làm 9 batch treo.
     */
    @Override
    public CrawlBatchResponse runOne(UUID specializationId, String username) {
        CrawlBatch batch = prepareBatch(specializationId, username);
        try {
            // Qua proxy, KHÔNG gọi thẳng runCrawlAsync() — xem javadoc của `self`.
            self.runCrawlAsync(batch.getId());
        } catch (Exception e) {
            log.error("Không đưa được batch {} vào hàng đợi crawl", batch.getId(), e);
            crawlPersistenceService.markPipelineFailed(batch.getId(),
                    "Không đưa được vào hàng đợi crawl: " + e.getMessage());
            throw e;
        }
        return crawlBatchMapper.toResponse(batch, false, true);
    }

    /**
     * Cào toàn bộ Chuyên ngành ĐANG HOẠT ĐỘNG và đã cấu hình category VietnamWorks.
     *
     * Lọc {@code isActive}: trước đây dùng bản truy vấn không lọc, nên Chuyên ngành
     * CM đã tắt vẫn bị cào — vẫn tốn lượt gọi VietnamWorks, vẫn sinh dữ liệu thô và
     * vẫn chảy vào bước tính Trending Weight.
     *
     * Một Chuyên ngành hỏng không được làm hỏng cả đợt, nên lỗi bắt theo từng vòng
     * lặp và ghi vào kết quả trả về thay vì ném ra ngoài.
     */
    @Override
    public CrawlAllResponse runAll(String username) {
        List<Specialization> specs = specializationRepository.findActiveWithVietnamworksCategoryConfigured();

        List<CrawlAllResultItem> results = new ArrayList<>();
        int failed = 0;
        for (Specialization spec : specs) {
            try {
                CrawlBatchResponse batch = runOne(spec.getId(), username);
                results.add(CrawlAllResultItem.builder()
                        .specializationId(spec.getId())
                        .specializationCode(spec.getCode())
                        .success(true)
                        .batch(batch)
                        .build());
            } catch (Exception e) {
                failed++;
                log.error("Crawl failed for specialization {}", spec.getCode(), e);
                results.add(CrawlAllResultItem.builder()
                        .specializationId(spec.getId())
                        .specializationCode(spec.getCode())
                        .success(false)
                        .errorMessage(e.getMessage())
                        .build());
            }
        }

        return CrawlAllResponse.builder()
                .results(results)
                .totalSpecializationsProcessed(specs.size())
                .totalSpecializationsFailed(failed)
                .build();
    }

    /**
     * Xin dừng một phiên crawl.
     *
     * QUY TẮC QUYỀN: chỉ người đã bấm chạy phiên đó mới dừng được phiên của mình;
     * Content Manager khác không đụng vào được. Riêng Admin/Super Admin dừng được
     * mọi phiên — đây là đường can thiệp khi một CM bấm chạy rồi nghỉ/đi vắng mà
     * phiên vẫn chiếm Chuyên ngành đó.
     *
     * Chỉ ĐẶT CỜ rồi trả về ngay, không chờ luồng crawl dừng hẳn: luồng đó đang
     * giữa một lượt gọi HTTP tới VietnamWorks, ép nó dừng ngay sẽ để lại batch nửa
     * vời. Nó tự đọc cờ trước trang kế tiếp và thoát êm.
     */
    @Override
    @Transactional
    public void requestCancel(UUID batchId, UUID requesterId, boolean requesterIsAdmin, String reason) {
        String status = crawlBatchRepository.findStatusById(batchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batch not found"));

        if (!"RUNNING".equals(status)) {
            throw new CrawlerBusinessException("Phiên crawl này đã kết thúc (" + status + "), không còn gì để dừng");
        }

        UUID owner = crawlBatchRepository.findTriggeredByIdById(batchId).orElse(null);
        boolean cancellingSomeoneElse = owner == null || !owner.equals(requesterId);

        if (!requesterIsAdmin && cancellingSomeoneElse) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Phiên crawl này do người khác chạy — chỉ người đó hoặc Admin mới dừng được");
        }

        // Dừng phiên của NGƯỜI KHÁC thì BẮT BUỘC nêu lý do: người bị dừng chỉ có
        // đúng dòng này để hiểu chuyện gì vừa xảy ra. Tự dừng phiên của mình thì
        // không cần giải trình với ai.
        String trimmedReason = reason != null ? reason.trim() : "";
        if (cancellingSomeoneElse && trimmedReason.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do khi dừng phiên thu thập của người khác");
        }

        // UPDATE có điều kiện status='RUNNING': hai người cùng bấm dừng thì người
        // sau nhận 0 dòng và được báo rõ, thay vì cả hai cùng thấy "đã gửi yêu cầu".
        if (crawlBatchRepository.requestCancel(batchId, requesterId,
                trimmedReason.isEmpty() ? null : trimmedReason) == 0) {
            throw new CrawlerBusinessException("Phiên crawl đã được yêu cầu dừng trước đó hoặc vừa kết thúc");
        }
        log.info("[crawl] Batch {} nhan yeu cau dung tu user {} (admin={}, ly do='{}')",
                batchId, requesterId, requesterIsAdmin, trimmedReason);

        if (cancellingSomeoneElse && owner != null) {
            notifyOwnerOfCancellation(batchId, owner, requesterId, trimmedReason);
        }
    }

    /**
     * Báo cho người đã bấm chạy biết phiên của họ vừa bị người khác dừng.
     *
     * Thiếu thông báo này thì Content Manager đang theo dõi tiến độ chỉ thấy phiên
     * đứng im rồi chuyển "Đã dừng" mà không rõ nguyên nhân — dễ hiểu nhầm là hệ
     * thống hỏng và bấm chạy lại ngay, tạo đúng phiên mà Admin vừa muốn ngăn.
     *
     * Lỗi ghi thông báo KHÔNG được phép làm hỏng việc dừng: việc dừng đã ghi xong
     * ở trên, nên bọc try/catch riêng và chỉ log nếu hỏng.
     */
    private void notifyOwnerOfCancellation(UUID batchId, UUID ownerId, UUID cancellerId, String reason) {
        try {
            UserAccount owner = userAccountRepository.findById(ownerId).orElse(null);
            if (owner == null) {
                return;
            }
            String cancellerName = userAccountRepository.findById(cancellerId)
                    .map(u -> u.getDisplayName() != null && !u.getDisplayName().isBlank()
                            ? u.getDisplayName() : u.getUsername())
                    .orElse("Quản trị viên");

            notificationRepository.save(Notification.builder()
                    .user(owner)
                    .type("CRAWL_BATCH_CANCELLED_BY_OTHER")
                    .title("Phiên thu thập dữ liệu của bạn đã bị dừng")
                    .body(cancellerName + " đã dừng một phiên thu thập dữ liệu do bạn khởi động."
                            + (reason.isEmpty() ? "" : " Lý do: " + reason))
                    .metadata(Map.of("batchId", batchId.toString()))
                    .isRead(false)
                    .build());
        } catch (Exception e) {
            log.error("Khong gui duoc thong bao dung phien cho chu batch {}", batchId, e);
        }
    }

    /**
     * Dừng mọi phiên người gọi được phép dừng.
     *
     * Bỏ qua trong im lặng những phiên không thuộc quyền (CM bấm khi trên hệ thống
     * còn phiên của người khác) — báo lỗi ở đây là sai, vì yêu cầu "dừng những gì
     * tôi được dừng" đã hoàn thành đúng. Số trả về cho biết thực tế dừng được mấy
     * phiên để bên gọi hiển thị trung thực.
     */
    @Override
    @Transactional
    public int requestCancelAll(UUID requesterId, boolean requesterIsAdmin, String reason) {
        String trimmedReason = reason != null ? reason.trim() : "";
        List<CrawlBatch> running = crawlBatchRepository.findByStatus("RUNNING");

        // Dừng hàng loạt có thể chạm vào phiên của nhiều người — nếu trong lô có bất
        // kỳ phiên nào của người khác thì phải có lý do, cùng quy tắc với dừng lẻ.
        boolean touchesOthers = running.stream().anyMatch(b -> {
            UUID owner = b.getTriggeredBy() != null ? b.getTriggeredBy().getId() : null;
            return owner == null || !owner.equals(requesterId);
        }) && requesterIsAdmin;
        if (touchesOthers && trimmedReason.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do khi dừng phiên thu thập của người khác");
        }

        int cancelled = 0;
        for (CrawlBatch batch : running) {
            UUID owner = batch.getTriggeredBy() != null ? batch.getTriggeredBy().getId() : null;
            boolean isOthers = owner == null || !owner.equals(requesterId);
            if (!requesterIsAdmin && isOthers) {
                continue;
            }
            if (crawlBatchRepository.requestCancel(batch.getId(), requesterId,
                    trimmedReason.isEmpty() ? null : trimmedReason) > 0) {
                cancelled++;
                if (isOthers && owner != null) {
                    notifyOwnerOfCancellation(batch.getId(), owner, requesterId, trimmedReason);
                }
            }
        }
        log.info("[crawl] User {} (admin={}) xin dung {} phien, ly do='{}'",
                requesterId, requesterIsAdmin, cancelled, trimmedReason);
        return cancelled;
    }

    @Override
    @Async("crawlExecutor")
    public void runCrawlAsync(UUID batchId) {
        // Chạy trên crawl-job-* thread: request của CM đã trả 202 và nhả thread
        // Tomcat từ lâu, nên cũng không còn OSIV giữ connection theo request nữa.
        AtomicInteger totalParsed = new AtomicInteger();
        int totalFetchedSoFar = 0;
        try {
            CrawlPersistenceService.CrawlPlan plan = crawlPersistenceService.loadPlan(batchId);

            AtomicInteger fetchedSoFar = new AtomicInteger();
            VietnamWorksAdapter.CrawlSummary summary = vietnamWorksAdapter.fetchItJobs(
                    plan.categoryGroups(),
                    // Mỗi trang ghi ngay trong 1 transaction riêng, connection trả về
                    // pool xong mới sang trang tiếp theo (và sleep 1s).
                    (page, jobs, totalExpected) -> totalParsed.addAndGet(
                            crawlPersistenceService.persistPage(batchId, plan.specializationId(), jobs,
                                    totalExpected, fetchedSoFar.addAndGet(jobs.size()))),
                    // Đọc cờ dừng từ DB giữa mỗi trang. Đọc DB chứ không giữ cờ trong
                    // RAM: người bấm dừng là một request HTTP khác, chạy trên thread
                    // khác, nên phải qua một nơi cả hai cùng nhìn thấy.
                    () -> crawlPersistenceService.isCancelRequested(batchId));

            totalFetchedSoFar = summary.getTotalFetched();
            String status = crawlPersistenceService.finishBatch(batchId, plan.sourceId(),
                    summary.getTotalFetched(), totalParsed.get(), summary.getErrors(),
                    summary.getTotalExpected(), summary.isCancelled());

            log.info("Crawl batch {} xong: fetched {}, parsed {}, errors {}",
                    batchId, summary.getTotalFetched(), totalParsed.get(), summary.getErrors().size());

            // CANCELLED cũng KHÔNG nối chuỗi: người dùng đã bảo dừng thì dừng cả
            // pipeline, không phải chỉ dừng bước cào rồi vẫn âm thầm chạy normalize
            // (~20 phút) và tính lại trending weight trên dữ liệu dở dang.
            if (!"FAILED".equals(status) && !"CANCELLED".equals(status)) {
                // Mắt xích 1 của chuỗi tự động — CrawlPipelineListener nhận và gọi
                // normalize. Bắn sau finishBatch để listener chắc chắn đọc được batch
                // ở trạng thái đã chốt (normalize từ chối batch còn RUNNING).
                eventPublisher.publishEvent(new CrawlCompletedEvent(batchId, plan.specializationId()));
            }
        } catch (Exception e) {
            // Không rethrow: không còn ai bắt được exception trên async thread, và
            // batch phải được đóng trạng thái nếu không guard RUNNING sẽ kẹt mãi.
            log.error("Crawl batch {} failed", batchId, e);
            crawlPersistenceService.markBatchFailed(batchId, totalFetchedSoFar, totalParsed.get(), e);
        } catch (Throwable t) {
            // BẮT CẢ Error (OutOfMemoryError, StackOverflowError...). Nhánh
            // catch (Exception) ở trên KHÔNG với tới được chúng, nên trước đây một
            // OOM lúc parse payload lớn làm thread crawl-job-* chết lặng lẽ, batch
            // nằm RUNNING vĩnh viễn, và guard chặn luôn mọi lần cào sau của Chuyên
            // ngành đó — đúng triệu chứng "cào xong rồi đứng, không thu thập nữa".
            //
            // Ghi trạng thái xong PHẢI ném lại: Error nghĩa là JVM đang ở trạng thái
            // không lành, nuốt nó đi là giấu một sự cố hạ tầng thành một batch FAILED
            // trông bình thường.
            log.error("Crawl batch {} chết vì Error — đóng batch rồi ném lại", batchId, t);
            try {
                crawlPersistenceService.markBatchFailed(batchId, totalFetchedSoFar, totalParsed.get(),
                        new IllegalStateException("Crawl thread chết vì " + t.getClass().getSimpleName()
                                + ": " + t.getMessage(), t));
            } catch (Throwable ignored) {
                // Đang trong lúc JVM hấp hối (điển hình: OOM) thì ngay cả việc ghi DB
                // cũng có thể hỏng. Không che mất Error gốc vì một lỗi thứ cấp.
                log.error("[crawl] Không đóng nổi batch {} sau Error — vòng quét dọn định kỳ sẽ xử lý", batchId);
            }
            throw t;
        }
    }
}
