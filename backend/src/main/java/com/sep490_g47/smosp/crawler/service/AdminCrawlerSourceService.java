package com.sep490_g47.smosp.crawler.service;

import com.sep490_g47.smosp.crawler.dto.request.CrawlerSourceUpdateRequest;
import com.sep490_g47.smosp.crawler.dto.response.CrawlerSourceResponse;

import java.util.List;
import java.util.UUID;

/**
 * Nghiệp vụ quản trị nguồn crawl.
 *
 * Tách ra khỏi {@code AdminCrawlerSourceController} vì đó từng là module duy
 * nhất trong 28 controller viết logic thẳng trong controller và tiêm bốn
 * repository vào đó. Hệ quả không chỉ là lệch kiến trúc: {@code @Transactional}
 * phải đặt trên method controller — nơi nó bao cả việc bind request và
 * serialize response — và không có chỗ nào để viết L1 unit test cho module này.
 *
 * {@code actorIdentifier} là username hoặc email của người thao tác, lấy từ
 * {@code Principal} ở tầng controller. Cố ý KHÔNG truyền {@code Principal}
 * xuống đây để service không phụ thuộc vào tầng web — cùng cách
 * {@code TrendingWeightService} đang nhận {@code String username}.
 */
public interface AdminCrawlerSourceService {

    List<CrawlerSourceResponse> getSources();

    CrawlerSourceResponse updateSource(UUID id, CrawlerSourceUpdateRequest request, String actorIdentifier);

    CrawlerSourceResponse toggleSource(UUID id, String actorIdentifier);
}
