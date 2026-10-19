import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Trash2, X, ClipboardList, AlertTriangle } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import { getAdminErrorReports, deleteAdminErrorReport } from '../../services/reportService'
import './admin-ui.css'
import './AdminReportsPage.css'

const DELETE_REASONS = [
    { value: 'SPAM', label: 'Spam' },
    { value: 'INVALID', label: 'Nội dung không hợp lệ' },
    { value: 'DUPLICATE', label: 'Trùng lặp' },
    { value: 'OTHER', label: 'Khác' },
]

const STATUS_LABEL = {
    PENDING: 'Chờ xử lý',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Đã xử lý',
    DISMISSED: 'Bỏ qua',
    CANCELLED: 'Học sinh hủy',
}

// Phải khớp đủ 6 giá trị enum ReportEntityType, thiếu 2 giá trị thì UI rơi về
// hiện nguyên tên enum tiếng Anh (DEF_208)
const ENTITY_LABEL = {
    MAJOR: 'Ngành học',
    SPECIALIZATION: 'Chuyên ngành',
    NARROW_SPEC: 'Chuyên ngành hẹp',
    COURSE: 'Môn học',
    RESOURCE: 'Tài nguyên học tập',
    ROADMAP: 'Lộ trình học tập',
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

function statusCls(status) {
    return { PENDING: 'pending', IN_PROGRESS: 'progress', RESOLVED: 'resolved', DISMISSED: 'dismissed', CANCELLED: 'cancelled' }[status] ?? ''
}

export default function AdminReportsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Admin'

    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')

    // Selected report for view and delete actions (UC-88 — chỉ Admin, cần chọn lý do)
    // Selected report for view and delete actions (UC-88 — chỉ Admin, cần chọn lý do)
    const [selectedReport, setSelectedReport] = useState(null)
    const [deleteReason, setDeleteReason] = useState('')
    const [customReason, setCustomReason] = useState('')
    const [deleteError, setDeleteError] = useState(null)

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(5)

    const { toasts, showToast, dismissToast } = useCmToast()

    const loadReports = async () => {
        try {
            setLoading(true)
            const data = await getAdminErrorReports()
            const mapped = data.map(r => ({
                ...r,
                relatedPage: `${ENTITY_LABEL[r.entityType] || r.entityType} (ID: ${r.entityId})`,
                createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '---'
            }))
            setReports(mapped)
        } catch (err) {
            console.error("Failed to load reports:", err)
            showToast("Không thể tải danh sách báo cáo từ server", 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadReports()
    }, [])

    const filtered = reports.filter((r) => {
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter
        const q = search.trim().toLowerCase()
        const matchSearch = !q || r.description.toLowerCase().includes(q) || r.relatedPage.toLowerCase().includes(q)
        return matchStatus && matchSearch
    })

    const handleSelectReport = (report) => {
        setSelectedReport(report)
        setDeleteReason('')
        setCustomReason('')
        setDeleteError(null)
    }

    const handleClosePanel = () => {
        setSelectedReport(null)
        setDeleteReason('')
        setCustomReason('')
        setDeleteError(null)
    }

    /* UC-88: soft-delete kèm lý do — EX-01: bắt buộc chọn lý do */
    const handleConfirmDelete = async () => {
        if (!deleteReason) {
            setDeleteError('Vui lòng chọn lý do trước khi xóa') // NAC-56-G1
            return
        }
        if (deleteReason === 'OTHER' && !customReason.trim()) {
            setDeleteError('Vui lòng nhập lý do cụ thể')
            return
        }
        const finalReason = deleteReason === 'OTHER' ? `OTHER: ${customReason.trim()}` : deleteReason;
        try {
            await deleteAdminErrorReport(selectedReport.id, finalReason)
            const reasonLabel = deleteReason === 'OTHER' ? `Khác: ${customReason.trim()}` : (DELETE_REASONS.find((r) => r.value === deleteReason)?.label || deleteReason)
            showToast(`Đã xóa báo cáo — lý do: ${reasonLabel}`, 'success')
            handleClosePanel()
            // Chỉ splice ở client thì danh sách lệch với server ngay khi có người khác
            // thao tác song song — phải tải lại từ server (DEF_209)
            await loadReports()
        } catch (err) {
            console.error("Failed to delete report:", err)
            setDeleteError(err.response?.data?.message || 'Có lỗi xảy ra khi xóa báo cáo.')
        }
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    // Pagination calculations
    const totalItems = filtered.length
    const totalPages = Math.ceil(totalItems / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const paginatedReports = filtered.slice(startIndex, startIndex + pageSize)

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages)
    }

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
        }
    }

    return (
        <Layout
            role="admin"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="cmer-page">
                <header className="adm-head" style={{ marginBottom: 16 }}>
                    <div className="adm-head-main">
                        <span className="adm-head-icon"><AlertTriangle size={20} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="adm-title">Xử lý báo cáo lỗi</h1>
                            <p className="adm-sub">
                                Quản lý, kiểm duyệt và xử lý các báo cáo phản hồi từ người dùng hệ thống
                            </p>
                        </div>
                    </div>
                </header>
                <div className="cmer-wrap">
                    {/* LEFT PANEL: Table list */}
                    <div className="cmer-left-panel">
                        <div className="cmer-tree-top">
                            <div className="adm-search">
                                <Search size={15} strokeWidth={2.4} />
                                <input
                                    placeholder="Tìm theo mô tả hoặc trang liên quan..."
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                    aria-label="Tìm kiếm báo cáo lỗi"
                                />
                            </div>
                            <div className="cmer-filter-bar">
                                {['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'CANCELLED'].map((s) => (
                                    <button
                                        key={s}
                                        className={`cmer-filter-chip${statusFilter === s ? ' cmer-filter-chip--active' : ''}`}
                                        onClick={() => {
                                            setStatusFilter(s)
                                            setCurrentPage(1)
                                        }}
                                        type="button"
                                    >
                                        {s === 'ALL' ? 'Tất cả' : STATUS_LABEL[s]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="cmer-list-body">
                            {loading ? (
                                <div className="cmer-loading">Đang tải danh sách báo cáo...</div>
                            ) : paginatedReports.length === 0 ? (
                                <div className="cmer-empty-state">Không tìm thấy báo cáo nào phù hợp.</div>
                            ) : (
                                <>
                                    <div className="cmer-table-wrapper">
                                        <table className="cmer-table">
                                            <thead>
                                                <tr>
                                                    <th>Phân loại</th>
                                                    <th>Mô tả lỗi</th>
                                                    <th>Ngày gửi</th>
                                                    <th>Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedReports.map((r) => (
                                                    <tr
                                                        key={r.id}
                                                        className={`cmer-row-clickable${selectedReport?.id === r.id ? ' cmer-row--active' : ''}`}
                                                        onClick={() => handleSelectReport(r)}
                                                    >
                                                        <td className="cmer-col-type">
                                                            <span className="cmer-type-badge">
                                                                {ENTITY_LABEL[r.entityType] || r.entityType}
                                                            </span>
                                                        </td>
                                                        <td className="cmer-col-desc">
                                                            <span className="cmer-desc-text">
                                                                {r.description}
                                                            </span>
                                                        </td>
                                                        <td className="cmer-col-date">
                                                            {r.createdAt}
                                                        </td>
                                                        <td className="cmer-col-status">
                                                            <span className={`cmer-status-dot cmer-status-dot--${statusCls(r.status)}`} />
                                                            <span className="cmer-status-text">
                                                                {STATUS_LABEL[r.status] || r.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="cmer-pagination" style={{ justifyContent: 'flex-end', gap: 8 }}>
                                        {/* setPageSize được khai nhưng không có control nào gọi (DEF_207) */}
                                        <label className="cmer-pag-info" htmlFor="adm-page-size">Số dòng/trang</label>
                                        <select
                                            id="adm-page-size"
                                            className="cmer-pag-btn"
                                            value={pageSize}
                                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                                        >
                                            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        <span className="cmer-pag-info">Tổng {totalItems} báo cáo</span>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="cmer-pagination">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                className="cmer-pag-btn"
                                                type="button"
                                            >
                                                ⟨
                                            </button>
                                            <span className="cmer-pag-info">{currentPage} / {totalPages}</span>
                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                className="cmer-pag-btn"
                                                type="button"
                                            >
                                                ⟩
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Details / Action Form */}
                    <div className="cmer-right-panel">
                        {selectedReport ? (
                            <>
                                <div className="cmer-panel-header">
                                    <div className="cmer-panel-meta">
                                        <div className="cmer-panel-eyebrow">
                                            Phân loại: {ENTITY_LABEL[selectedReport.entityType] || selectedReport.entityType}
                                        </div>
                                        <div className="cmer-panel-title">Chi tiết Báo cáo Lỗi</div>
                                    </div>
                                </div>

                                <div className="cmer-panel-body">
                                    <div className="cmer-detail-group">
                                        <span className="cmer-detail-label">Nội dung từ sinh viên</span>
                                        <p className="cmer-detail-desc-box">{selectedReport.description}</p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div className="cmer-detail-group" style={{ flex: 1 }}>
                                            <span className="cmer-detail-label">Thời gian báo cáo</span>
                                            <span className="cmer-detail-value">{selectedReport.createdAt}</span>
                                        </div>
                                        <div className="cmer-detail-group" style={{ flex: 1 }}>
                                            <span className="cmer-detail-label">Trạng thái hiện tại</span>
                                            <span className="cmer-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className={`cmer-status-dot cmer-status-dot--${statusCls(selectedReport.status)}`} />
                                                {STATUS_LABEL[selectedReport.status]}
                                            </span>
                                        </div>
                                    </div>

                                    <hr className="cmer-divider" />

                                    <div className="cmer-form-section">
                                        <h3 className="cmer-section-title">Xác nhận xóa báo cáo (Quyền Admin)</h3>
                                        <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                                            Đây là tính năng soft-delete của Admin. Báo cáo không hợp lệ hoặc spam sẽ được ẩn khỏi hệ thống và lưu lý do.
                                        </p>

                                        <form onSubmit={(e) => { e.preventDefault(); handleConfirmDelete(); }} className="cmer-form">
                                            <div className="cmer-form-group">
                                                <label className="cmer-form-label">
                                                    Lý do xóa <span className="cmer-required">*</span>
                                                </label>
                                                <select
                                                    className="cmer-form-select"
                                                    value={deleteReason}
                                                    onChange={(e) => { setDeleteReason(e.target.value); setDeleteError(null); }}
                                                >
                                                    <option value="">-- Chọn lý do xóa --</option>
                                                    {DELETE_REASONS.map((r) => (
                                                        <option key={r.value} value={r.value}>{r.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {deleteReason === 'OTHER' && (
                                                <div className="cmer-form-group">
                                                    <label className="cmer-form-label">
                                                        Lý do chi tiết <span className="cmer-required">*</span>
                                                    </label>
                                                    <textarea
                                                        className="cmer-form-textarea"
                                                        placeholder="Nhập lý do xóa cụ thể ở đây..."
                                                        value={customReason}
                                                        onChange={(e) => { setCustomReason(e.target.value); setDeleteError(null); }}
                                                        rows={3}
                                                    />
                                                </div>
                                            )}

                                            {deleteError && (
                                                <div className="cmer-error-msg">
                                                    <AlertTriangle size={14} strokeWidth={2.4} /> {deleteError}
                                                </div>
                                            )}

                                            <div className="cmer-form-actions" style={{ gap: '8px' }}>
                                                <button type="button" className="cm-btn cm-btn--secondary" onClick={handleClosePanel}>
                                                    <X size={14} strokeWidth={2.4} /> Hủy
                                                </button>
                                                <button type="submit" className="cm-btn cm-btn--danger-solid">
                                                    <Trash2 size={14} strokeWidth={2.4} /> Xác nhận xóa
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="cmer-empty">
                                <ClipboardList className="cmer-empty-icon" size={30} strokeWidth={1.8} />
                                <span className="cmer-empty-text">Chọn một báo cáo từ danh sách để xem chi tiết hoặc thực hiện xóa.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}