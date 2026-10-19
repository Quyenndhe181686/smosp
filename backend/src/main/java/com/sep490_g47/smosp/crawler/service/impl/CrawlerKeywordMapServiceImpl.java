package com.sep490_g47.smosp.crawler.service.impl;

import com.sep490_g47.smosp.crawler.dto.request.CreateKeywordRequest;
import com.sep490_g47.smosp.crawler.dto.request.UpdateKeywordRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlerKeywordMapResponse;
import com.sep490_g47.smosp.crawler.entity.CrawlerKeywordMap;
import com.sep490_g47.smosp.crawler.repository.CrawlerKeywordMapRepository;
import com.sep490_g47.smosp.crawler.service.CrawlerKeywordMapService;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CrawlerKeywordMapServiceImpl implements CrawlerKeywordMapService {

    private final CrawlerKeywordMapRepository keywordMapRepository;
    private final NarrowSpecRepository narrowSpecRepository;

    @Override
    public List<CrawlerKeywordMapResponse> getKeywords(UUID narrowSpecId) {
        if (!narrowSpecRepository.existsById(narrowSpecId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpec not found");
        }
        return keywordMapRepository.findByNarrowSpecId(narrowSpecId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CrawlerKeywordMapResponse createKeyword(CreateKeywordRequest request) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(request.getNarrowSpecId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpec not found"));

        String normalizedKeyword = request.getKeyword().trim().toLowerCase();
        if (keywordMapRepository.existsByNarrowSpecIdAndKeywordIgnoreCase(request.getNarrowSpecId(), normalizedKeyword)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keyword đã tồn tại cho Narrow Specialization này");
        }

        // Trước đây create bỏ qua hoàn toàn tier/score nên mọi từ khoá sinh ra đều
        // là CORE_BASE/3. Hậu quả: một từ khoá chung chung như "database" tự nó đã
        // đủ qua cổng hasCore và kéo tin về — đúng thứ hạng SUPPORT sinh ra để ngăn.
        String tier = request.getTier() != null ? request.getTier() : "CORE_BASE";
        Integer score = request.getScore() != null ? request.getScore() : defaultScoreFor(tier);

        CrawlerKeywordMap entity = CrawlerKeywordMap.builder()
                .narrowSpec(narrowSpec)
                .keyword(normalizedKeyword)
                .active(true)
                .tier(tier)
                .score(score)
                .build();

        CrawlerKeywordMap saved = keywordMapRepository.save(entity);
        return mapToResponse(saved);
    }

    /** Điểm gợi ý theo bảng ERD, chỉ dùng khi CM không nhập score. */
    private int defaultScoreFor(String tier) {
        return switch (tier) {
            case "CORE_IDENTIFIER" -> 5;
            case "SUPPORT" -> 1;
            default -> 3;
        };
    }

    @Override
    @Transactional
    public CrawlerKeywordMapResponse updateKeyword(UUID id, UpdateKeywordRequest request) {
        CrawlerKeywordMap entity = keywordMapRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Keyword not found"));

        if (request.getKeyword() != null) {
            String normalizedKeyword = request.getKeyword().trim().toLowerCase();
            if (keywordMapRepository.existsByNarrowSpecIdAndKeywordIgnoreCaseAndIdNot(
                    entity.getNarrowSpec().getId(), normalizedKeyword, id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keyword đã tồn tại cho Narrow Specialization này");
            }
            entity.setKeyword(normalizedKeyword);
        }

        if (request.getActive() != null) {
            entity.setActive(request.getActive());
        }

        // Cố ý KHÔNG suy lại score khi chỉ đổi tier: điểm có thể đã được CM tinh
        // chỉnh tay, ghi đè nó sẽ âm thầm xoá lựa chọn đó. Muốn điểm chạy theo tier
        // thì gửi kèm score.
        if (request.getTier() != null) {
            entity.setTier(request.getTier());
        }

        if (request.getScore() != null) {
            entity.setScore(request.getScore());
        }

        CrawlerKeywordMap saved = keywordMapRepository.save(entity);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public void deleteKeyword(UUID id) {
        CrawlerKeywordMap entity = keywordMapRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Keyword not found"));
        keywordMapRepository.delete(entity);
    }

    private CrawlerKeywordMapResponse mapToResponse(CrawlerKeywordMap entity) {
        return CrawlerKeywordMapResponse.builder()
                .id(entity.getId())
                .narrowSpecId(entity.getNarrowSpec().getId())
                .narrowSpecName(entity.getNarrowSpec().getName())
                .keyword(entity.getKeyword())
                .active(entity.isActive())
                .tier(entity.getTier())
                .score(entity.getScore())
                .build();
    }
}
