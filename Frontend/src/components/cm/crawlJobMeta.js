/**
 * Hằng số và hàm tính dùng chung cho bảng theo dõi phiên thu thập dữ liệu.
 *
 * Tách khỏi CrawlJobList.jsx vì file component chỉ nên export component — export
 * lẫn hằng số làm hỏng hot-reload của Vite (react-refresh), sửa một dòng CSS là
 * cả trang phải tải lại.
 */

/* Các bước của 1 batch: Thu thập ➔ Chuẩn hóa ➔ Tính Trending Weight */
export const PHASE_META = {
  CRAWL: { label: 'Đang thu thập dữ liệu', cls: 'cjl-phase--crawl', running: true },
  NORMALIZE: { label: 'Đang chuẩn hóa', cls: 'cjl-phase--normalize', running: true },
  CALCULATE: { label: 'Đang tính Trending Weight', cls: 'cjl-phase--calculate', running: true },
  DONE: { label: 'Hoàn tất', cls: 'cjl-phase--done', running: false },
  FAILED: { label: 'Thất bại', cls: 'cjl-phase--failed', running: false },
  CANCELLED: { label: 'Đã dừng', cls: 'cjl-phase--cancelled', running: false }
}

/* Field stage do backend tính (CrawlBatchResponse.stage) ➔ bước hiển thị ở FE */
export const STAGE_TO_PHASE = {
  CRAWLING: 'CRAWL',
  NORMALIZING: 'NORMALIZE',
  CALCULATING: 'CALCULATE',
  DONE: 'DONE',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
}

/**
 * % của thanh tiến độ: bước thu thập lấy crawlProgressPercent (total_fetched /
 * total_expected do backend tính sẵn), bước chuẩn hóa tự tính từ số tracking đã
 * chốt trạng thái. null = chưa đủ dữ liệu để tính, hiện thanh mờ thay vì 0%.
 */
export function jobProgressPercent(job) {
  if (job.phase === 'CRAWL') {
    const pct = job.batch?.crawlProgressPercent
    return typeof pct === 'number' ? pct : null
  }
  if (job.phase === 'NORMALIZE' && job.normalize) {
    const pending = job.normalize.pending || 0
    const success = job.normalize.success || 0
    const failed = job.normalize.failed || 0
    const total = pending + success + failed
    if (total === 0) return null
    return Math.round(((success + failed) * 100) / total)
  }
  if (job.phase === 'DONE') return 100
  return null
}
