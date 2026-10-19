package com.sep490_g47.smosp.crawler.service;

import com.sep490_g47.smosp.crawler.dto.request.CreateKeywordRequest;
import com.sep490_g47.smosp.crawler.dto.request.UpdateKeywordRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlerKeywordMapResponse;

import java.util.List;
import java.util.UUID;

public interface CrawlerKeywordMapService {
    List<CrawlerKeywordMapResponse> getKeywords(UUID narrowSpecId);
    CrawlerKeywordMapResponse createKeyword(CreateKeywordRequest request);
    CrawlerKeywordMapResponse updateKeyword(UUID id, UpdateKeywordRequest request);
    void deleteKeyword(UUID id);
}
