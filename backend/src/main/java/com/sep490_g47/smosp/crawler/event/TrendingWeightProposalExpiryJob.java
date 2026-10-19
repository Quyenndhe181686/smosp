package com.sep490_g47.smosp.crawler.event;

import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposal;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import com.sep490_g47.smosp.crawler.repository.TrendingWeightProposalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * UC-95/AC-49-04/BR-37 — đề xuất Trending Weight còn PENDING quá 7 ngày không ai
 * duyệt phải tự động chuyển sang AUTO_REJECTED.
 *
 * Trước đây {@code TrendingWeightProposalStatus} chỉ có PENDING/ACCEPTED/REJECTED
 * và package {@code crawler} chỉ có đúng một {@code @Scheduled}
 * ({@link OrphanTrackingSweeper}, không liên quan proposal) — không có job nào
 * làm việc này, đề xuất cũ nằm PENDING vĩnh viễn.
 *
 * Cố ý dùng {@code AUTO_REJECTED} chứ không phải {@code REJECTED}: "hệ thống tự
 * huỷ vì hết hạn" và "CM đã xem rồi từ chối" là hai chuyện khác hẳn nhau, gộp lại
 * sẽ làm chỉ số {@code rejectedTwProposals} mất ý nghĩa.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TrendingWeightProposalExpiryJob {

    private static final int EXPIRE_AFTER_DAYS = 7;

    private final TrendingWeightProposalRepository proposalRepository;

    @Value("${smosp.crawler.tw-proposal-expiry.enabled:true}")
    private boolean enabled;

    /**
     * Mặc định 3h30 sáng — sau {@link OrphanTrackingSweeper#scheduledSweep()}
     * (3h00) một chút để không tranh connection vào cùng thời điểm, dù cả hai đều
     * là thao tác nhẹ.
     */
    @Scheduled(cron = "${smosp.crawler.tw-proposal-expiry.cron:0 30 3 * * *}")
    @Transactional
    public void expireStaleProposals() {
        if (!enabled) {
            log.debug("[tw-expiry] Đã tắt qua smosp.crawler.tw-proposal-expiry.enabled=false — bỏ qua");
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(EXPIRE_AFTER_DAYS);
        List<TrendingWeightProposal> stale = proposalRepository
                .findByStatusAndCreatedAtBefore(TrendingWeightProposalStatus.PENDING, cutoff);

        if (stale.isEmpty()) {
            return;
        }

        for (TrendingWeightProposal p : stale) {
            p.setStatus(TrendingWeightProposalStatus.AUTO_REJECTED);
        }
        proposalRepository.saveAll(stale);

        log.info("[tw-expiry] Da tu dong AUTO_REJECTED {} de xuat Trending Weight PENDING qua {} ngay",
                stale.size(), EXPIRE_AFTER_DAYS);
    }
}
