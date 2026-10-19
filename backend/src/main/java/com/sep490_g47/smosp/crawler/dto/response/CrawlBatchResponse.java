package com.sep490_g47.smosp.crawler.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class CrawlBatchResponse {
    private UUID id;
    private String status;
    private UUID scopeSpecializationId;
    /**
     * Tên/mã Chuyên ngành của phiên — CHỈ có khi tập kết quả nhỏ (1 batch, hoặc
     * danh sách batch đang chạy). Danh sách toàn bộ lịch sử để null vì nạp tên cho
     * từng dòng là N+1 query. Xem CrawlBatchMapper.toResponse(includeStage).
     */
    private String scopeSpecializationName;
    private String scopeSpecializationCode;
    private Integer totalFetched;
    private Integer totalParsed;
    private Integer totalErrors;
    // Tổng số job nguồn báo có ở trang đầu — null với batch cũ hoặc khi nguồn không trả meta.
    private Integer totalExpected;
    // totalFetched * 100 / totalExpected, chặn trần 100. null khi chưa biết
    // totalExpected (không ném lỗi chia 0) — FE hiểu là "chưa xác định được %".
    private Integer crawlProgressPercent;
    // CRAWLING | NORMALIZING | CALCULATING | DONE | FAILED. Tính runtime ở
    // CrawlBatchMapper, không lưu cột DB.
    private String stage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String triggeredBy;
    /** Tên hiển thị của người bấm chạy — để CM khác biết phiên này của ai. */
    private String triggeredByName;
    private UUID triggeredById;
    /** Đã có người bấm dừng, luồng crawl sẽ thoát ở trang kế tiếp. */
    private Boolean cancelRequested;
    /** Ai đã dừng phiên và vì sao — để người bị dừng biết chuyện gì vừa xảy ra. */
    private String cancelledByName;
    private String cancelReason;
    /**
     * Người đang gọi API có được dừng phiên này không — tính ở máy chủ, KHÔNG để FE
     * tự suy ra. FE chỉ dùng để ẩn/hiện nút; máy chủ vẫn kiểm lại khi thực sự dừng.
     */
    private Boolean canCancel;
    private String errorLog;
}
