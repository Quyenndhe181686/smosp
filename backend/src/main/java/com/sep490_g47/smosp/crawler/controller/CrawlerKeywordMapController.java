package com.sep490_g47.smosp.crawler.controller;

import com.sep490_g47.smosp.crawler.dto.request.CreateKeywordRequest;
import com.sep490_g47.smosp.crawler.dto.request.UpdateKeywordRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlerKeywordMapResponse;
import com.sep490_g47.smosp.crawler.service.CrawlerKeywordMapService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cm/crawler-keywords")
@PreAuthorize("hasAnyRole('CONTENT_MANAGER')")
@RequiredArgsConstructor
public class CrawlerKeywordMapController {

    private final CrawlerKeywordMapService service;

    @GetMapping
    public ResponseEntity<List<CrawlerKeywordMapResponse>> getKeywords(
            @RequestParam UUID narrowSpecId) {
        return ResponseEntity.ok(service.getKeywords(narrowSpecId));
    }

    @PostMapping
    public ResponseEntity<CrawlerKeywordMapResponse> createKeyword(
            @Valid @RequestBody CreateKeywordRequest request) {
        return ResponseEntity.ok(service.createKeyword(request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<CrawlerKeywordMapResponse> updateKeyword(
            @PathVariable UUID id,
            // @Valid bắt buộc phải có, nếu không thì @Pattern/@Min/@Max trên
            // UpdateKeywordRequest chỉ là chú thích: tier sai chính tả hay score
            // âm sẽ đi thẳng xuống DB.
            @Valid @RequestBody UpdateKeywordRequest request) {
        return ResponseEntity.ok(service.updateKeyword(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKeyword(@PathVariable UUID id) {
        service.deleteKeyword(id);
        return ResponseEntity.noContent().build();
    }
}
