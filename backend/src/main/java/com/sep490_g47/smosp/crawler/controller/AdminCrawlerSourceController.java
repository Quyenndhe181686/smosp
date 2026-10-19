package com.sep490_g47.smosp.crawler.controller;

import com.sep490_g47.smosp.crawler.dto.request.CrawlerSourceUpdateRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlerSourceResponse;
import com.sep490_g47.smosp.crawler.service.AdminCrawlerSourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/crawler/sources")
@RequiredArgsConstructor
public class AdminCrawlerSourceController {

    private final AdminCrawlerSourceService adminCrawlerSourceService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<CrawlerSourceResponse> getSources() {
        return adminCrawlerSourceService.getSources();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CrawlerSourceResponse updateSource(@PathVariable UUID id,
                                              @Valid @RequestBody CrawlerSourceUpdateRequest request,
                                              Principal principal) {
        return adminCrawlerSourceService.updateSource(id, request, principalName(principal));
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public CrawlerSourceResponse toggleSource(@PathVariable UUID id, Principal principal) {
        return adminCrawlerSourceService.toggleSource(id, principalName(principal));
    }

    /**
     * Chỉ tầng này biết {@link Principal}; service nhận username/email dạng String
     * để không phụ thuộc vào tầng web. Trả null khi không có principal — service
     * xử lý trường hợp đó và ghi WARN, không âm thầm bỏ qua.
     */
    private String principalName(Principal principal) {
        return principal != null ? principal.getName() : null;
    }
}
