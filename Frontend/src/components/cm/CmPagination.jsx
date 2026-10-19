import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './cm-ui.css'

/**
 * Phân trang dùng chung cho toàn bộ trang Curriculum Manager.
 *
 * Bố cục cố định, mọi trang giống hệt nhau:
 *   [ Hiển thị a–b trên N ] [ n / trang ]      [ ‹ Trước ] [ ô nhập ] / [ tổng ] [ Sau › ]
 *
 * Ô ở giữa nhập tay được: gõ số rồi Enter (hoặc rời ô) là nhảy trang, giá trị
 * ngoài khoảng sẽ được kẹp về 1..totalPages.
 *
 * @param {number}   page             trang hiện tại (1-based)
 * @param {number}   totalPages       tổng số trang
 * @param {Function} onPageChange     (page) => void
 * @param {number}   [totalItems]     tổng số bản ghi — có thì hiện dòng "Hiển thị…"
 * @param {number}   [pageSize]       số bản ghi mỗi trang
 * @param {Function} [onPageSizeChange] (size) => void — có thì hiện ô chọn cỡ trang
 * @param {number[]} [pageSizeOptions]
 * @param {string}   [itemLabel]      danh từ đếm, ví dụ "môn học"
 * @param {boolean}  [bare]           bỏ vạch kẻ trên (dùng trong card nhỏ)
 * @param {boolean}  [center]         căn giữa cụm điều khiển
 * @param {boolean}  [hideWhenSingle] ẩn hẳn khi chỉ có 1 trang và không có ô cỡ trang
 */
export default function CmPagination({
    page,
    totalPages,
    onPageChange,
    totalItems = null,
    pageSize = null,
    onPageSizeChange = null,
    pageSizeOptions = [5, 10, 20, 50],
    itemLabel = 'mục',
    bare = false,
    center = false,
    hideWhenSingle = false,
    className = ''
}) {
    const safeTotal = Math.max(1, Number(totalPages) || 1)
    const safePage = Math.min(safeTotal, Math.max(1, Number(page) || 1))

    // Bản nháp của ô nhập: cho phép gõ dở dang (kể cả rỗng) mà không nhảy trang.
    // Đồng bộ lại ngay trong lúc render khi trang đổi từ bên ngoài (đổi cỡ trang,
    // đổi bộ lọc…) — cách React khuyến nghị thay cho setState trong useEffect.
    const [draft, setDraft] = useState(String(safePage))
    const [syncedPage, setSyncedPage] = useState(safePage)
    if (syncedPage !== safePage) {
        setSyncedPage(safePage)
        setDraft(String(safePage))
    }

    if (hideWhenSingle && safeTotal <= 1 && !onPageSizeChange) return null

    const goTo = (value) => {
        const next = Math.min(safeTotal, Math.max(1, Number(value) || 1))
        setDraft(String(next))
        if (next !== safePage) onPageChange(next)
    }

    const commit = () => {
        if (draft === '') { setDraft(String(safePage)); return }
        goTo(draft)
    }

    const showMeta = totalItems !== null || onPageSizeChange
    const from = totalItems ? Math.min(totalItems, (safePage - 1) * (pageSize || 0) + 1) : 0
    const to = totalItems && pageSize ? Math.min(totalItems, safePage * pageSize) : totalItems

    return (
        <div className={`cmp${bare ? ' cmp--bare' : ''}${center || !showMeta ? ' cmp--center' : ''}${className ? ' ' + className : ''}`}>
            {showMeta && (
                <div className="cmp-meta">
                    {totalItems !== null && (
                        <span className="cmp-range">
                            {totalItems > 0
                                ? <>Hiển thị <strong>{from}–{to}</strong> trên <strong>{totalItems}</strong> {itemLabel}</>
                                : <>Không có {itemLabel} nào</>}
                        </span>
                    )}
                    {onPageSizeChange && (
                        <select
                            className="cmp-size"
                            value={pageSize ?? ''}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            aria-label="Số dòng mỗi trang"
                        >
                            {pageSizeOptions.map(size => (
                                <option key={size} value={size}>{size} / trang</option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            <div className="cmp-controls">
                <button
                    type="button"
                    className="cmp-btn"
                    onClick={() => goTo(safePage - 1)}
                    disabled={safePage <= 1}
                    aria-label="Trang trước"
                >
                    <ChevronLeft size={15} strokeWidth={2.4} />
                    <span className="cmp-btn-text">Trước</span>
                </button>

                <div className="cmp-jump">
                    <input
                        className="cmp-input"
                        type="number"
                        min={1}
                        max={safeTotal}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commit() }
                            if (e.key === 'Escape') setDraft(String(safePage))
                        }}
                        onBlur={commit}
                        onFocus={(e) => e.target.select()}
                        aria-label={`Trang hiện tại, tổng ${safeTotal} trang`}
                    />
                    <span className="cmp-sep">/</span>
                    <span className="cmp-total">{safeTotal}</span>
                </div>

                <button
                    type="button"
                    className="cmp-btn"
                    onClick={() => goTo(safePage + 1)}
                    disabled={safePage >= safeTotal}
                    aria-label="Trang sau"
                >
                    <span className="cmp-btn-text">Sau</span>
                    <ChevronRight size={15} strokeWidth={2.4} />
                </button>
            </div>
        </div>
    )
}
