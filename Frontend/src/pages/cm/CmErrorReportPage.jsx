import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ExternalLink, Inbox, Save, AlertTriangle, Clock, Loader, CheckCircle2,
    XCircle, Ban, RefreshCw, Lock, UserCheck
} from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import { getCmErrorReports, processErrorReport } from '../../services/reportService'
import './CmErrorReportPage.css'

/* Mỗi trạng thái có nhãn, tông màu và icon riêng — đọc được mức độ ngay từ màu,
   không phải dò theo chấm tròn xám. */
const STATUSES = {
    PENDING: { label: 'Chờ xử lý', tone: 'red', icon: Clock },
    IN_PROGRESS: { label: 'Đang xử lý', tone: 'orange', icon: Loader },
    RESOLVED: { label: 'Đã xử lý', tone: 'green', icon: CheckCircle2 },
    DISMISSED: { label: 'Bỏ qua', tone: 'neutral', icon: XCircle },
    CANCELLED: { label: 'Sinh viên đã hủy', tone: 'neutral', icon: Ban },
}

const FILTER_ORDER = ['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'CANCELLED']

const ENTITY_TYPES = {
    MAJOR: 'Ngành học',
    SPECIALIZATION: 'Chuyên ngành',
    NARROW_SPEC: 'Chuyên ngành hẹp',
    COURSE: 'Môn học',
    RESOURCE: 'Học liệu',
    ROADMAP: 'Lộ trình',
}

/* Trạng thái bắt buộc phải có ghi chú xử lý (ràng buộc phía máy chủ) */
const NOTE_REQUIRED_STATUSES = ['RESOLVED', 'DISMISSED']

/* Máy chủ chỉ nhận IN_PROGRESS / RESOLVED / DISMISSED (DEF_96). Trước đây danh
   sách này còn có PENDING, mà form lại mặc định đúng trạng thái hiện tại của báo
   cáo — nên mở một báo cáo đang "Chờ xử lý" rồi bấm Lưu ngay sẽ ăn 400. */
const STATUS_OPTIONS = [
    { value: 'IN_PROGRESS', label: 'Đang xử lý', tone: 'orange' },
    { value: 'RESOLVED', label: 'Đã xử lý (đã khắc phục)', tone: 'green' },
    { value: 'DISMISSED', label: 'Bỏ qua (sai lệch hoặc trùng lặp)', tone: 'gray' },
]

function StatusTag({ status }) {
    const meta = STATUSES[status]
    if (!meta) return <span className="cm-tag cm-tag--neutral">{status}</span>
    const Icon = meta.icon
    return (
        <span className={`cm-tag cm-tag--${meta.tone}`}>
            <Icon size={11} strokeWidth={2.4} /> {meta.label}
        </span>
    )
}

export default function CmErrorReportPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Content Manager'
    /* So khớp theo id, không theo tên hiển thị: hai CM có thể trùng tên. */
    const currentUserId = localStorage.getItem('userId')
    const { toasts, showToast, dismissToast } = useCmToast()

    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('ALL')

    const [selectedReport, setSelectedReport] = useState(null)
    const [statusForm, setStatusForm] = useState('PENDING')
    const [processingNote, setProcessingNote] = useState('')
    const [saving, setSaving] = useState(false)

    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 10

    /* Tăng lên mỗi lần bấm "Làm mới" — hiệu ứng tải lại bám vào biến này nên
       không phải gọi setState ngay trong thân effect. */
    const [reloadToken, setReloadToken] = useState(0)

    useEffect(() => {
        let alive = true
        getCmErrorReports(statusFilter !== 'ALL' ? statusFilter : '')
            .then(data => {
                if (!alive) return
                const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                setReports(sorted)
            })
            .catch(err => {
                console.error('Không tải được danh sách báo cáo:', err)
                if (alive) showToast('Không tải được danh sách báo cáo lỗi', 'error')
            })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [reloadToken, statusFilter, showToast])

    const loadReports = () => {
        setLoading(true)
        setReloadToken(t => t + 1)
    }

    /* Báo cáo chưa ai nhận thì hành động mặc định là nhận xử lý — PENDING không
       còn là lựa chọn hợp lệ để gửi lên máy chủ. */
    const handleSelectReport = (r) => {
        setSelectedReport(r)
        setStatusForm(r.status === 'PENDING' ? 'IN_PROGRESS' : r.status)
        setProcessingNote(r.processingNote || '')
    }

    const handleProcessSubmit = async (e) => {
        e.preventDefault()

        if (NOTE_REQUIRED_STATUSES.includes(statusForm) && !processingNote.trim()) {
            showToast(
                `Vui lòng nhập ghi chú xử lý khi chuyển sang trạng thái "${STATUSES[statusForm].label}"`,
                'warning'
            )
            return
        }

        setSaving(true)
        try {
            const updated = await processErrorReport(selectedReport.id, {
                status: statusForm,
                processingNote: processingNote.trim()
            })
            setReports(prev => prev.map(r => (r.id === updated.id ? updated : r)))
            setSelectedReport(updated)
            showToast('Đã cập nhật trạng thái xử lý báo cáo')
        } catch (err) {
            console.error('Không cập nhật được báo cáo:', err)
            showToast(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật trạng thái xử lý', 'error')
            /* 403 ở đây gần như luôn là "CM khác vừa nhận báo cáo này trước" —
               danh sách đang hiển thị đã cũ, tải lại để thấy đúng người đang giữ. */
            if (err.response?.status === 403) {
                loadReports()
            }
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    // Client-side filtering is no longer needed since we filter on the server.
    const filtered = reports
    const totalPages = Math.ceil(filtered.length / pageSize)
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    /* Báo cáo do CM khác đang giữ: máy chủ sẽ trả 403 nếu cố lưu, nên khoá form
       ngay tại đây thay vì để CM gõ xong ghi chú rồi mới báo lỗi. Máy chủ vẫn là
       nơi quyết định cuối cùng — đây chỉ là lớp chặn sớm cho đỡ mất công. */
    const lockedByOther = Boolean(
        selectedReport?.assignedToId &&
        currentUserId &&
        selectedReport.assignedToId !== currentUserId
    )

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            {/* cmer-scope-cm: AdminReportsPage.jsx cũng dùng class gốc "cmer-page"
                và trùng luôn cả .cmer-table / .cmer-col-desc / .cmer-col-status.
                Cần một class RIÊNG của trang này để neo CSS, nếu không mọi rule
                viết cho bảng ở đây sẽ đè sang trang Admin. */}
            <div className="cmer-page cmer-scope-cm">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><AlertTriangle size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Báo cáo lỗi nội dung</h1>
                            <p className="cm-page-sub">
                                Tiếp nhận và phản hồi các báo cáo sai sót dữ liệu môn học, kỹ năng và danh mục ngành từ sinh viên
                            </p>
                        </div>
                    </div>
                    <div className="cm-page-head-actions">
                        {/* Pending count removed since we don't fetch ALL anymore */}
                        <button type="button" className="cm-btn cm-btn--secondary" onClick={loadReports} disabled={loading}>
                            <RefreshCw size={14} strokeWidth={2.4} className={loading ? 'cmer-spin' : ''} />
                            Làm mới
                        </button>
                    </div>
                </header>

                <div className="cmer-wrap">

                    {/* ── Danh sách báo cáo ── */}
                    <div className="cmer-left-panel">
                        <div className="cmer-tree-top">
                            <div className="cmer-filter-bar">
                                {FILTER_ORDER.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`cmer-chip${statusFilter === key ? ' is-active' : ''}`}
                                        onClick={() => { setStatusFilter(key); setCurrentPage(1); setLoading(true) }}
                                    >
                                        {key === 'ALL' ? 'Tất cả' : STATUSES[key].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="cmer-list-body">
                            {loading ? (
                                <div className="cmer-placeholder">Đang tải danh sách báo cáo...</div>
                            ) : paginated.length === 0 ? (
                                <div className="cmer-placeholder">Không có báo cáo nào phù hợp với bộ lọc</div>
                            ) : (
                                <>
                                    <div className="cmer-table-wrapper">
                                        <table className="cmer-table">
                                            <thead>
                                                <tr>
                                                    {/* Bề rộng cột PHẢI khai ở <th>: table-layout:fixed lấy
                                                        kích thước từ hàng đầu tiên, đặt ở <td> không có tác
                                                        dụng và mọi cột sẽ bị chia đều bằng nhau. */}
                                                    <th className="cmer-col-entity">Nội dung bị báo</th>
                                                    <th className="cmer-col-desc">Mô tả lỗi</th>
                                                    <th className="cmer-col-assignee">Người xử lý</th>
                                                    <th className="cmer-col-date">Ngày gửi</th>
                                                    <th className="cmer-col-status">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginated.map((r) => (
                                                    <tr
                                                        key={r.id}
                                                        className={`cmer-row${selectedReport?.id === r.id ? ' is-selected' : ''}`}
                                                        onClick={() => handleSelectReport(r)}
                                                    >
                                                        {/* Phân loại gộp vào đây thay vì đứng riêng một cột: sáu cột
                                                            làm bảng rộng quá panel trái, tràn ngang và cắt mất cột đầu. */}
                                                        <td className="cmer-col-entity">
                                                            <span className="cmer-entity">
                                                                <span className="cmer-entity-type">
                                                                    {ENTITY_TYPES[r.entityType] || r.entityType}
                                                                </span>
                                                                {r.entityName ? (
                                                                    <span className="cmer-entity-name" title={r.entityName}>
                                                                        {r.entityName}
                                                                        {r.entityCode && (
                                                                            <span className="cmer-entity-code">{r.entityCode}</span>
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span className="cmer-entity-name cmer-entity--unknown" title={r.entityId}>
                                                                        Không xác định
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="cmer-col-desc">
                                                            <span className="cmer-desc-text" title={r.description}>
                                                                {r.description}
                                                            </span>
                                                        </td>
                                                        <td className="cmer-col-assignee">
                                                            {r.assignedToId ? (
                                                                <span
                                                                    className={`cmer-assignee${r.assignedToId === currentUserId ? ' is-mine' : ''}`}
                                                                    title={r.assignedToName || 'Đã có người nhận'}
                                                                >
                                                                    {r.assignedToId === currentUserId
                                                                        ? <><UserCheck size={11} strokeWidth={2.4} /> Bạn</>
                                                                        : <><Lock size={11} strokeWidth={2.4} /> {r.assignedToName || 'CM khác'}</>}
                                                                </span>
                                                            ) : (
                                                                <span className="cmer-assignee cmer-assignee--none">Chưa nhận</span>
                                                            )}
                                                        </td>
                                                        <td className="cmer-col-date">
                                                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '—'}
                                                        </td>
                                                        <td className="cmer-col-status">
                                                            <StatusTag status={r.status} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="cmer-pagination">
                                            <CmPagination
                                                page={currentPage}
                                                totalPages={totalPages}
                                                onPageChange={setCurrentPage}
                                                bare
                                                center
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Chi tiết và xử lý ── */}
                    <div className="cmer-right-panel">
                        {selectedReport ? (
                            <>
                                <div className="cmer-panel-header">
                                    <div className="cmer-panel-meta">
                                        <div className="cmer-panel-eyebrow">
                                            {ENTITY_TYPES[selectedReport.entityType] || selectedReport.entityType}
                                            {selectedReport.entityCode && ` · ${selectedReport.entityCode}`}
                                        </div>
                                        <div className="cmer-panel-title">
                                            {selectedReport.entityName || 'Chi tiết báo cáo lỗi'}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="cm-btn cm-btn--secondary cm-btn--sm"
                                        onClick={() => {
                                            // Điều hướng đúng theo từng loại nội dung, không dồn hết
                                            // học liệu/lộ trình về màn Danh mục chung (DEF_97)
                                            const { entityType, entityId } = selectedReport
                                            const target = {
                                                COURSE: '/cm/courses',
                                                RESOURCE: '/cm/courses',
                                                ROADMAP: '/cm/curriculum',
                                                NARROW_SPEC: '/cm/catalog',
                                                SPECIALIZATION: '/cm/catalog',
                                                MAJOR: '/cm/catalog',
                                            }[entityType] || '/cm/catalog'
                                            navigate(target, {
                                                state: { selectedId: entityId, entityType },
                                            })
                                        }}
                                    >
                                        <ExternalLink size={13} strokeWidth={2.4} /> Đi tới nội dung
                                    </button>
                                </div>

                                <div className="cmer-panel-body">
                                    <div className="cmer-detail-group">
                                        <span className="cmer-detail-label">Nội dung sinh viên phản ánh</span>
                                        <p className="cmer-detail-desc-box">{selectedReport.description}</p>
                                    </div>

                                    <div className="cmer-detail-row">
                                        <div className="cmer-detail-group">
                                            <span className="cmer-detail-label">Thời gian báo cáo</span>
                                            <span className="cmer-detail-value">
                                                {selectedReport.createdAt
                                                    ? new Date(selectedReport.createdAt).toLocaleString('vi-VN')
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className="cmer-detail-group">
                                            <span className="cmer-detail-label">Trạng thái hiện tại</span>
                                            <StatusTag status={selectedReport.status} />
                                        </div>
                                        <div className="cmer-detail-group">
                                            <span className="cmer-detail-label">Người xử lý</span>
                                            <span className="cmer-detail-value">
                                                {selectedReport.assignedToId
                                                    ? (selectedReport.assignedToId === currentUserId
                                                        ? 'Bạn đang xử lý'
                                                        : (selectedReport.assignedToName || 'Content Manager khác'))
                                                    : 'Chưa có ai tiếp nhận'}
                                            </span>
                                        </div>
                                    </div>

                                    <hr className="cmer-divider" />

                                    <h3 className="cmer-section-title">Xử lý phản hồi</h3>

                                    {/* Ghi chú đã lưu phải hiện ở mọi báo cáo đã có kết luận,
                                        không chỉ báo cáo bị huỷ (DEF_95) */}
                                    {(selectedReport.status === 'RESOLVED' || selectedReport.status === 'DISMISSED') &&
                                        selectedReport.processingNote && (
                                            <div className="cmer-cancelled-box">
                                                <Ban size={16} strokeWidth={2.2} />
                                                <div>
                                                    Báo cáo này đã được xử lý xong.
                                                    <div className="cmer-cancelled-note">
                                                        <strong>Ghi chú trước đó:</strong> {selectedReport.processingNote}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    {selectedReport.status === 'CANCELLED' ? (
                                        <div className="cmer-cancelled-box">
                                            <Ban size={16} strokeWidth={2.2} />
                                            <div>
                                                Báo cáo này đã được sinh viên hủy, không cần xử lý thêm.
                                                {selectedReport.processingNote && (
                                                    <div className="cmer-cancelled-note">
                                                        <strong>Ghi chú trước đó:</strong> {selectedReport.processingNote}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : lockedByOther ? (
                                        <div className="cmer-cancelled-box">
                                            <Lock size={16} strokeWidth={2.2} />
                                            <div>
                                                Báo cáo này đang được <strong>{selectedReport.assignedToName || 'một Content Manager khác'}</strong> xử lý,
                                                bạn không thể cập nhật. Nếu người đó ngừng hoạt động, báo cáo sẽ tự quay lại hàng chờ để người khác nhận.
                                                {selectedReport.processingNote && (
                                                    <div className="cmer-cancelled-note">
                                                        <strong>Ghi chú xử lý hiện tại:</strong> {selectedReport.processingNote}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleProcessSubmit} className="cmer-form">
                                            {!selectedReport.assignedToId && (
                                                <p className="cmer-claim-hint">
                                                    Lưu thay đổi đồng nghĩa bạn nhận xử lý báo cáo này — các Content Manager khác sẽ không sửa được nữa.
                                                </p>
                                            )}
                                            <div className="cmer-form-group">
                                                <label className="cmer-form-label">Cập nhật trạng thái</label>
                                                <CmSelect
                                                    options={STATUS_OPTIONS}
                                                    value={statusForm}
                                                    onChange={setStatusForm}
                                                    tinted
                                                    searchable={false}
                                                />
                                            </div>

                                            <div className="cmer-form-group">
                                                <label className="cmer-form-label">
                                                    Ghi chú xử lý
                                                    {NOTE_REQUIRED_STATUSES.includes(statusForm) && (
                                                        <span className="cmer-required"> *</span>
                                                    )}
                                                </label>
                                                <textarea
                                                    className="cmer-form-textarea"
                                                    value={processingNote}
                                                    onChange={(e) => setProcessingNote(e.target.value)}
                                                    placeholder="Ghi rõ kết quả đã khắc phục, hoặc lý do bỏ qua báo cáo này..."
                                                    rows={5}
                                                />
                                            </div>

                                            <div className="cmer-form-actions">
                                                <button type="submit" className="cm-btn cm-btn--primary" disabled={saving}>
                                                    <Save size={14} strokeWidth={2.4} />
                                                    {saving ? 'Đang lưu...' : 'Lưu kết quả xử lý'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="cmer-empty">
                                <span className="cmer-empty-icon"><Inbox size={40} strokeWidth={1.4} /></span>
                                <p className="cmer-empty-text">
                                    Chọn một báo cáo ở danh sách bên trái để xem chi tiết và cập nhật trạng thái xử lý.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}
