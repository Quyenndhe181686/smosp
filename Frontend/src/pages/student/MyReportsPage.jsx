import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../services/authService'
import { Folder } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import { getMyErrorReports, updateErrorReport, cancelErrorReport, getErrorReportById } from '../../services/reportService'
import './MyReportsPage.css'

const STATUS_LABELS = {
    PENDING: 'Chờ xử lý',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Đã xử lý',
    DISMISSED: 'Bỏ qua',
    CANCELLED: 'Đã hủy',
}

const ENTITY_TYPES = [
    { value: 'NARROW_SPEC', label: 'Chuyên ngành hẹp' },
    { value: 'SPECIALIZATION', label: 'Chuyên ngành' },
    { value: 'MAJOR', label: 'Ngành học' },
    { value: 'COURSE', label: 'Môn học' },
    { value: 'RESOURCE', label: 'Tài nguyên học tập' },
    { value: 'ROADMAP', label: 'Lộ trình học tập' },
]

/* Trước đây trả về "Môn học (a1b2c3d4)" — một đoạn UUID cắt ngắn, sinh viên đọc
   không biết là báo cáo về nội dung nào. Nay máy chủ trả kèm tên/mã thật, chỉ
   lùi về UUID với báo cáo cũ tạo trước khi có hai trường đó. */
function getReportLabel(r) {
    const matched = ENTITY_TYPES.find(t => t.value === r.entityType)
    const label = matched ? matched.label : r.entityType
    if (r.entityName) {
        return r.entityCode ? `${label}: ${r.entityName} (${r.entityCode})` : `${label}: ${r.entityName}`
    }
    const shortId = r.entityId ? r.entityId.substring(0, 8) : 'N/A'
    return `${label} (${shortId})`
}

function statusCls(status) {
    return { PENDING: 'new', IN_PROGRESS: 'progress', RESOLVED: 'resolved', DISMISSED: 'dismissed', CANCELLED: 'cancelled' }[status] ?? ''
}

const DESC_MAX = 1000

export default function MyReportsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Sinh viên'

    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedId, setSelectedId] = useState(null)
    const [editingDesc, setEditingDesc] = useState(null) // string | null
    const [editError, setEditError] = useState(null)
    const [cancelTarget, setCancelTarget] = useState(null)
    const [toast, setToast] = useState(null)
    const [loadError, setLoadError] = useState(null)

    const showToast = (text) => { setToast(text); setTimeout(() => setToast(null), 2500) }

    const fetchReports = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getMyErrorReports()
            setReports(data)
            setLoadError(null)
        } catch (err) {
            console.error('Failed to load error reports:', err)
            setLoadError(err.response?.data?.message || 'Không tải được danh sách báo cáo từ hệ thống.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchReports() }, [fetchReports])

    const filtered = reports.filter((r) => statusFilter === 'ALL' || r.status === statusFilter)
    const [selected, setSelected] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)

    useEffect(() => {
        if (!selectedId) {
            setSelected(null)
            return
        }
        let active = true
        const fetchDetail = async () => {
            setDetailLoading(true)
            try {
                const detail = await getErrorReportById(selectedId)
                if (active) setSelected(detail)
            } catch (err) {
                console.error("Failed to fetch detail:", err)
                showToast("Không thể tải chi tiết báo cáo.")
            } finally {
                if (active) setDetailLoading(false)
            }
        }
        fetchDetail()
        return () => { active = false }
    }, [selectedId])

    const startEdit = () => {
        setEditingDesc(selected.description)
        setEditError(null)
    }

    const saveEdit = async () => {
        if (!editingDesc.trim()) {
            return setEditError('Mô tả không được để trống')
        }
        if (editingDesc.trim().length > DESC_MAX) {
            return setEditError(`Mô tả không được vượt quá ${DESC_MAX} ký tự`)
        }
        try {
            const res = await updateErrorReport(selected.id, { description: editingDesc.trim() })
            setReports((prev) =>
                prev.map((r) => (r.id === selected.id ? { ...r, description: res.description } : r))
            )
            setEditingDesc(null)
            showToast('Đã cập nhật mô tả báo cáo')
        } catch (err) {
            console.error('Failed to update error report:', err)
            setEditError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật báo cáo')
        }
    }

    const confirmCancel = async () => {
        try {
            await cancelErrorReport(cancelTarget.id)
            setReports((prev) =>
                prev.map((r) => (r.id === cancelTarget.id ? { ...r, status: 'CANCELLED' } : r))
            )
            showToast('Đã hủy báo cáo')
            setCancelTarget(null)
            setSelectedId(null)
        } catch (err) {
            console.error('Failed to cancel report:', err)
            showToast(err.response?.data?.message || 'Có lỗi xảy ra khi hủy báo cáo')
            setCancelTarget(null)
        }
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    return (
        <Layout
            role="student"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="myr-page">
                <div className="myr-header">
                    <div>
                        <h1 className="myr-title">
                            <span className="myr-title-icon"><Folder size={20} strokeWidth={2.5} /></span>
                            Báo cáo của tôi
                        </h1>
                        <p className="myr-subtitle">Theo dõi các báo cáo lỗi nội dung đã gửi</p>
                    </div>
                    <button className="myr-btn-primary" onClick={() => navigate('/student/content-report')} type="button">
                        + Báo lỗi mới
                    </button>
                </div>

                <div className="myr-body">
                    {/* ── List ── */}
                    <div className="myr-list-card">
                        <div className="myr-filter-bar">
                            {['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'CANCELLED'].map((s) => (
                                <button
                                    key={s}
                                    className={`myr-filter-chip${statusFilter === s ? ' myr-filter-chip--active' : ''}`}
                                    onClick={() => setStatusFilter(s)}
                                    type="button"
                                >
                                    {s === 'ALL' ? 'Tất cả' : STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="myr-empty">Đang tải danh sách báo cáo...</div>
                        ) : loadError ? (
                            <div className="myr-empty">
                                <div className="myr-empty-icon">⚠️</div>
                                <p>{loadError}</p>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>
                                    Đây là lỗi tải dữ liệu, không có nghĩa là bạn chưa gửi báo cáo nào.
                                </p>
                                <button className="myr-btn-primary-sm" type="button" onClick={fetchReports} style={{ marginTop: '10px' }}>
                                    Thử lại
                                </button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="myr-empty">
                                <div className="myr-empty-icon">🗂</div>
                                <p>Chưa có báo cáo nào ở trạng thái này</p>
                            </div>
                        ) : (
                            <div className="myr-list">
                                {filtered.map((r) => (
                                    <button
                                        key={r.id}
                                        className={`myr-row${selectedId === r.id ? ' myr-row--active' : ''}`}
                                        onClick={() => { setSelectedId(r.id); setEditingDesc(null) }}
                                        type="button"
                                    >
                                        <div className="myr-row-main">
                                            <span className="myr-row-page">{getReportLabel(r)}</span>
                                            <span className="myr-row-desc">{r.description}</span>
                                        </div>
                                        <div className="myr-row-side">
                                            <span className={`myr-status-badge myr-status-badge--${statusCls(r.status)}`}>
                                                {STATUS_LABELS[r.status]}
                                            </span>
                                            <span className="myr-row-date">
                                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="myr-detail-card">
                        {!selectedId ? (
                            <div className="myr-detail-placeholder">Chọn một báo cáo để xem chi tiết</div>
                        ) : detailLoading ? (
                            <div className="myr-detail-placeholder">Đang tải chi tiết...</div>
                        ) : !selected ? (
                            <div className="myr-detail-placeholder">Không tìm thấy chi tiết báo cáo</div>
                        ) : (
                            <>
                                <div className="myr-detail-head">
                                    <div>
                                        <div className="myr-detail-page">{getReportLabel(selected)}</div>
                                        <span className={`myr-status-badge myr-status-badge--${statusCls(selected.status)}`}>
                                            {STATUS_LABELS[selected.status]}
                                        </span>
                                    </div>
                                    {selected.status === 'PENDING' && editingDesc === null && (
                                        <div className="myr-detail-actions">
                                            <button className="myr-btn-ghost-sm" onClick={startEdit} type="button">Chỉnh sửa</button>
                                            <button className="myr-btn-ghost-sm myr-btn-ghost-sm--danger" onClick={() => setCancelTarget(selected)} type="button">
                                                Hủy báo cáo
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="myr-divider" />

                                {selected.assignedToName && selected.status === 'IN_PROGRESS' && (
                                    <p className="myr-assignee-line">
                                        Đang được xử lý bởi <strong>{selected.assignedToName}</strong>
                                    </p>
                                )}

                                <div className="myr-detail-label">Mô tả lỗi</div>
                                {editingDesc !== null ? (
                                    <>
                                        <textarea
                                            className="myr-edit-textarea"
                                            value={editingDesc}
                                            onChange={(e) => setEditingDesc(e.target.value)}
                                            rows={5}
                                            maxLength={DESC_MAX}
                                        />
                                        <div className="myr-detail-label" style={{ textAlign: 'right', fontWeight: 400 }}>
                                            {editingDesc.length}/{DESC_MAX}
                                        </div>
                                        {editError && <div className="myr-form-error">{editError}</div>}
                                        <div className="myr-edit-actions">
                                            <button className="myr-btn-ghost-sm" onClick={() => setEditingDesc(null)} type="button">Hủy</button>
                                            <button className="myr-btn-primary-sm" onClick={saveEdit} type="button">Lưu thay đổi</button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="myr-detail-desc">{selected.description}</p>
                                )}

                                {selected.processingNote && (selected.status === 'RESOLVED' || selected.status === 'DISMISSED') && (
                                    <>
                                        <div className="myr-divider" />
                                        <div className="myr-detail-label">Ghi chú xử lý từ Content Manager</div>
                                        <p className="myr-detail-desc" style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '0.5px solid #e2e8f0', color: '#1e293b' }}>
                                            {selected.processingNote}
                                        </p>
                                    </>
                                )}

                                {selected.status === 'CANCELLED' && (
                                    <p className="myr-locked-note" style={{ marginTop: '16px' }}>
                                        Bạn đã hủy báo cáo này nên không thể chỉnh sửa hoặc hủy tiếp.
                                    </p>
                                )}

                                {selected.status !== 'PENDING' && selected.status !== 'CANCELLED' && (
                                    <p className="myr-locked-note" style={{ marginTop: '16px' }}>
                                        Báo cáo đã được Content Manager tiếp nhận xử lý nên không thể chỉnh sửa hoặc hủy.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Cancel confirm modal ── */}
            {cancelTarget && (
                <div className="myr-modal-overlay" onClick={() => setCancelTarget(null)}>
                    <div className="myr-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="myr-modal-title">Hủy báo cáo này?</div>
                        <p className="myr-modal-text">
                            Báo cáo về "{getReportLabel(cancelTarget)}" sẽ chuyển sang trạng thái Đã hủy và không còn hiển thị cho Content Manager.
                        </p>
                        <div className="myr-modal-actions">
                            <button className="myr-btn-ghost-sm" type="button" onClick={() => setCancelTarget(null)}>Không hủy</button>
                            <button className="myr-btn-danger-sm" type="button" onClick={confirmCancel}>Xác nhận hủy</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="myr-toast">{toast}</div>}
        </Layout>
    )
}