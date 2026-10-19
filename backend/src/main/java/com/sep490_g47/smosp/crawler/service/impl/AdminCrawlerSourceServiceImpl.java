package com.sep490_g47.smosp.crawler.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.common.exception.CrawlerBusinessException;
import com.sep490_g47.smosp.crawler.dto.request.CrawlerSourceUpdateRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlerSourceResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlBatch;
import com.sep490_g47.smosp.crawler.entity.CrawlerSource;
import com.sep490_g47.smosp.crawler.repository.CrawlBatchRepository;
import com.sep490_g47.smosp.crawler.repository.CrawlerSourceRepository;
import com.sep490_g47.smosp.crawler.service.AdminCrawlerSourceService;
import com.sep490_g47.smosp.transcript.entity.AdminActionLog;
import com.sep490_g47.smosp.transcript.repository.AdminActionLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCrawlerSourceServiceImpl implements AdminCrawlerSourceService {

    private final CrawlerSourceRepository crawlerSourceRepository;
    private final CrawlBatchRepository crawlBatchRepository;
    private final AdminActionLogRepository adminActionLogRepository;
    private final UserAccountRepository userAccountRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public List<CrawlerSourceResponse> getSources() {
        return crawlerSourceRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Cập nhật cấu hình + ghi audit trong CÙNG một transaction.
     *
     * Không có {@code @Transactional}, Spring Data JPA cho mỗi {@code save()} một
     * transaction riêng: cấu hình commit xong rồi audit log mới lỗi thì cấu hình
     * đã đổi thật nhưng client nhận 500 và không còn dấu vết nào.
     */
    @Override
    @Transactional
    public CrawlerSourceResponse updateSource(UUID id, CrawlerSourceUpdateRequest request, String actorIdentifier) {
        CrawlerSource source = crawlerSourceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Crawler source not found"));

        if (crawlBatchRepository.existsBySourceIdAndStatus(id, "RUNNING")) {
            throw new CrawlerBusinessException("Không thể sửa cấu hình khi đang có tiến trình crawl chạy");
        }

        if (request.getScheduleCron() != null && !request.getScheduleCron().trim().isEmpty()) {
            String cronExpr = request.getScheduleCron().trim();
            if (!CronExpression.isValidExpression(cronExpr)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Biểu thức cron không hợp lệ");
            }

            // NAC-54-01: cam tan suat crawl duoi 24h. isValidExpression() chi kiem
            // CU PHAP — "0 * * * * *" (moi phut) hop le cu phap va truoc day duoc
            // luu thang, scheduler se thuc thi that. Cao VietnamWorks moi phut co
            // the bi chan IP/rate-limit, giet toan bo luong thu thap du lieu, va
            // viec go chan khong nam trong tay du an.
            CronExpression parsed = CronExpression.parse(cronExpr);
            LocalDateTime first = parsed.next(LocalDateTime.now());
            LocalDateTime second = first != null ? parsed.next(first) : null;
            if (first != null && second != null && Duration.between(first, second).toHours() < 24) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Lịch crawl phải cách nhau ít nhất 24 giờ (NAC-54-01)");
            }
        }

        Map<String, Object> changes = new HashMap<>();
        changes.put("old_name", source.getName());
        changes.put("new_name", request.getName());
        changes.put("old_scheduleCron", source.getScheduleCron());
        changes.put("new_scheduleCron", request.getScheduleCron());

        source.setName(request.getName());
        source.setScheduleCron(request.getScheduleCron() != null && request.getScheduleCron().trim().isEmpty()
                ? null : request.getScheduleCron());

        crawlerSourceRepository.save(source);
        logAction(actorIdentifier, "UPDATE_CRAWLER_SOURCE", source.getId(), changes);

        return mapToResponse(source);
    }

    @Override
    @Transactional
    public CrawlerSourceResponse toggleSource(UUID id, String actorIdentifier) {
        CrawlerSource source = crawlerSourceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Crawler source not found"));

        Boolean currentStatus = source.getIsEnabled() != null ? source.getIsEnabled() : true;

        if (currentStatus && crawlBatchRepository.existsBySourceIdAndStatus(id, "RUNNING")) {
            throw new CrawlerBusinessException("Không thể tắt nguồn khi đang có tiến trình crawl chạy");
        }

        Map<String, Object> changes = new HashMap<>();
        changes.put("old_isEnabled", currentStatus);
        changes.put("new_isEnabled", !currentStatus);

        source.setIsEnabled(!currentStatus);
        crawlerSourceRepository.save(source);

        // BR-38/BV-40a: Admin bat lai nguon sau khi tu dong tat (hoac tat tay) thi
        // cho chuoi that bai bat dau lai tu 0 — khong thi nguon vua bat len co the
        // bi tu tat lai ngay sau DUNG MOT lan fail tiep theo, vi bo dem cu van con
        // dung o nguong.
        if (!currentStatus) {
            crawlerSourceRepository.resetFailureCounter(source.getId());
        }

        logAction(actorIdentifier, "TOGGLE_CRAWLER_SOURCE", source.getId(), changes);

        return mapToResponse(source);
    }

    private CrawlerSourceResponse mapToResponse(CrawlerSource source) {
        long totalBatches = crawlBatchRepository.countBySourceId(source.getId());
        String lastStatus = crawlBatchRepository.findFirstBySourceIdOrderByStartedAtDesc(source.getId())
                .map(CrawlBatch::getStatus)
                .orElse(null);
        return CrawlerSourceResponse.builder()
                .id(source.getId())
                .name(source.getName())
                .adapterKey(source.getAdapterKey())
                .isEnabled(source.getIsEnabled())
                .scheduleCron(source.getScheduleCron())
                .lastRunAt(source.getLastRunAt())
                .createdAt(source.getCreatedAt())
                .updatedAt(source.getUpdatedAt())
                .totalBatches(totalBatches)
                .lastBatchStatus(lastStatus)
                .consecutiveFailures(source.getConsecutiveFailures())
                .firstFailureAt(source.getFirstFailureAt())
                .lastSuccessAt(source.getLastSuccessAt())
                .build();
    }

    /**
     * Mọi thay đổi Admin phải để lại audit trail — nguyên tắc các module Admin
     * khác đều giữ.
     *
     * Hai nhánh dưới đây từng {@code return} im lặng, nên thao tác vẫn ghi xuống
     * DB mà audit log không tăng và không ai biết. Đã probe thật: gọi
     * PATCH /toggle với principal không khớp UserAccount nào trả 200,
     * {@code isEnabled} đổi thành công, {@code adminActionLogRepository.count()}
     * đứng yên.
     *
     * Vẫn không ném exception: mất audit không đáng để huỷ một thao tác cấu hình
     * đã hợp lệ. Nhưng phải để lại dấu vết ở mức WARN để còn phát hiện được.
     */
    private void logAction(String actorIdentifier, String action, UUID targetId, Object detailObj) {
        if (actorIdentifier == null) {
            log.warn("[audit] Bo qua log '{}' tren target {} — request khong co principal", action, targetId);
            return;
        }
        UserAccount actor = userAccountRepository.findByUsername(actorIdentifier)
                .orElseGet(() -> userAccountRepository.findByEmail(actorIdentifier).orElse(null));
        if (actor == null) {
            log.warn("[audit] Bo qua log '{}' tren target {} — khong tra duoc UserAccount cho principal '{}'",
                    action, targetId, actorIdentifier);
            return;
        }

        String detail = "";
        try {
            detail = objectMapper.writeValueAsString(detailObj);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize action detail", e);
        }

        adminActionLogRepository.save(AdminActionLog.builder()
                .actor(actor)
                .action(action)
                .targetType("CRAWLER_SOURCE")
                .targetId(targetId)
                .detail(detail)
                .build());
    }
}
