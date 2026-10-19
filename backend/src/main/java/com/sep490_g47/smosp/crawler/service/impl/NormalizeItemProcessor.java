package com.sep490_g47.smosp.crawler.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490_g47.smosp.crawler.entity.CrawlerKeywordMap;
import com.sep490_g47.smosp.crawler.entity.JobNormalizeTracking;
import com.sep490_g47.smosp.crawler.entity.RawJob;
import com.sep490_g47.smosp.crawler.repository.JobNormalizeTrackingRepository;
import com.sep490_g47.smosp.crawler.repository.JobNormalizedRepository;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Xử lý normalize 1 raw_job trong transaction REQUIRES_NEW riêng — cô lập lỗi của
 * 1 job (kể cả lỗi ở tầng DB như duplicate key) khỏi các job khác trong cùng batch
 * xử lý của normalizeBySpecialization. Bắt buộc là bean riêng (không self-invocation)
 * để Spring proxy áp dụng đúng propagation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NormalizeItemProcessor {

    // narrow_spec_id không thể trùng UUID thật nào — dùng làm placeholder bắt buộc
    // vì native query không nhận list rỗng cho NOT IN.
    private static final UUID NO_MATCH_PLACEHOLDER_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    private final JobNormalizeTrackingRepository jobNormalizeTrackingRepository;
    private final JobNormalizedRepository jobNormalizedRepository;
    private final ObjectMapper objectMapper;

    @Getter
    public static class ProcessOneResult {
        private final boolean unmatched;
        private final int createdCount;
        private final List<String> matchedNsCodes;

        public ProcessOneResult(boolean unmatched, int createdCount, List<String> matchedNsCodes) {
            this.unmatched = unmatched;
            this.createdCount = createdCount;
            this.matchedNsCodes = matchedNsCodes;
        }
    }

    /**
     * Compile regex cho toàn bộ keyword của 1 Specialization MỘT LẦN, dùng lại cho
     * mọi job trong phiên normalize tối ưu CPU. 
     * Trước đây Pattern.compile() nằm bên trong processOne() -> vài trăm key x vài trăm job => tốn tài nguyên
     * 
     * Created by: BaoTQ - 260813
     */
    public Map<CrawlerKeywordMap, Pattern> compilePatterns(List<CrawlerKeywordMap> keywords) {
        Map<CrawlerKeywordMap, Pattern> compiled = new HashMap<>(keywords.size());
        for (CrawlerKeywordMap kw : keywords) {
            compiled.put(kw, Pattern.compile(
                    "(?<![a-zA-Z0-9])" + Pattern.quote(kw.getKeyword()) + "(?![a-zA-Z0-9])",
                    Pattern.CASE_INSENSITIVE));
        }
        return compiled;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProcessOneResult processOne(UUID trackingId, UUID specializationId, Map<CrawlerKeywordMap, Pattern> compiledPatterns, int capScore) {
        JobNormalizeTracking tracking = jobNormalizeTrackingRepository.findById(trackingId)
                .orElseThrow(() -> new IllegalStateException("Tracking not found: " + trackingId));
        RawJob rawJob = tracking.getRawJob();

        JsonNode rootNode;
        try {
            rootNode = objectMapper.readTree(rawJob.getRawPayload());
        } catch (Exception e) {
            throw new IllegalStateException("Invalid raw_payload JSON for raw_job " + rawJob.getId(), e);
        }

        String jobTitle = rootNode.path("jobTitle").asText(null);
        int jobLevelId = rootNode.path("jobLevelId").asInt(-1);
        String approvedOnStr = rootNode.path("approvedOn").asText(null);

        LocalDate postedDate = null;
        if (approvedOnStr != null && !approvedOnStr.isEmpty()) {
            try {
                postedDate = LocalDate.parse(approvedOnStr.substring(0, 10));
            } catch (Exception e) {
                log.warn("Could not parse approvedOn: {}", approvedOnStr);
            }
        }

        JsonNode skillsNode = rootNode.path("skills");
        List<String> rawSkills = new ArrayList<>();
        if (skillsNode.isArray()) {
            for (JsonNode skillNode : skillsNode) {
                String skillName = skillNode.path("skillName").asText("").trim().toLowerCase();
                if (!skillName.isEmpty()) {
                    rawSkills.add(skillName);
                }
            }
        }

        Map<NarrowSpecialization, Set<CrawlerKeywordMap>> nsMatchedKeywords = new HashMap<>();
        for (Map.Entry<CrawlerKeywordMap, Pattern> entry : compiledPatterns.entrySet()) {
            CrawlerKeywordMap kw = entry.getKey();
            Pattern pattern = entry.getValue();
            for (String skill : rawSkills) {
                if (pattern.matcher(skill).find()) {
                    nsMatchedKeywords.computeIfAbsent(kw.getNarrowSpec(), k -> new HashSet<>()).add(kw);
                    break;
                }
            }
        }

        Set<NarrowSpecialization> matchedNs = new HashSet<>();
        if (!nsMatchedKeywords.isEmpty()) {
            int maxScore = 0;
            for (Map.Entry<NarrowSpecialization, Set<CrawlerKeywordMap>> entry : nsMatchedKeywords.entrySet()) {
                boolean hasCore = false;
                int rawScore = 0;
                for (CrawlerKeywordMap kw : entry.getValue()) {
                    rawScore += kw.getScore();
                    if ("CORE_IDENTIFIER".equals(kw.getTier()) || "CORE_BASE".equals(kw.getTier())) {
                        hasCore = true;
                    }
                }
                if (!hasCore) {
                    continue;
                }
                int finalScore = Math.min(rawScore, capScore);
                if (finalScore > maxScore) {
                    maxScore = finalScore;
                    matchedNs.clear();
                    matchedNs.add(entry.getKey());
                } else if (finalScore == maxScore && maxScore > 0) {
                    matchedNs.add(entry.getKey());
                }
            }
        }

        String jobLevel = String.valueOf(jobLevelId);
        boolean isJunior = jobLevelId == 1 || jobLevelId == 8;
        boolean unmatched = matchedNs.isEmpty();
        List<String> matchedCodes = new ArrayList<>();

        if (unmatched) {
            jobNormalizedRepository.deleteStaleMatches(rawJob.getId(), specializationId,
                    List.of(NO_MATCH_PLACEHOLDER_ID), true);
            jobNormalizedRepository.upsertJobNormalized(rawJob.getId(), null, jobTitle, jobLevel,
                    null, isJunior, postedDate);
        } else {
            List<UUID> keepIds = matchedNs.stream().map(NarrowSpecialization::getId).toList();
            jobNormalizedRepository.deleteStaleMatches(rawJob.getId(), specializationId, keepIds, false);
            for (NarrowSpecialization ns : matchedNs) {
                jobNormalizedRepository.upsertJobNormalized(rawJob.getId(), ns.getId(), jobTitle, jobLevel,
                        null, isJunior, postedDate);
                matchedCodes.add(ns.getCode());
            }
        }

        tracking.setStatus("SUCCESS");
        tracking.setError(null);
        tracking.setProcessedAt(LocalDateTime.now());
        jobNormalizeTrackingRepository.save(tracking);

        return new ProcessOneResult(unmatched, unmatched ? 1 : matchedCodes.size(), matchedCodes);
    }

    // Transaction MỚI, riêng biệt với transaction đã rollback của processOne() —
    // không thể ghi tiếp vào entity tracking cũ sau khi transaction chứa nó đã abort.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(UUID trackingId, String errorMessage) {
        jobNormalizeTrackingRepository.findById(trackingId).ifPresent(tracking -> {
            tracking.setStatus("FAILED");
            tracking.setError(errorMessage);
            tracking.setProcessedAt(LocalDateTime.now());
            jobNormalizeTrackingRepository.save(tracking);
        });
    }
}
