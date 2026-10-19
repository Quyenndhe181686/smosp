import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    GraduationCap, Search, Users, UserCheck, UserX, CalendarPlus,
    RefreshCw, ShieldAlert, ShieldCheck, X, Inbox, User
} from 'lucide-react'
import { logout } from '../../services/authService'
import { getUsers, getUserStats, updateUserStatus } from '../../services/userService'
import Layout from '../../components/layout/Layout'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './admin-ui.css'
import './StudentAccountsPage.css'

const STUDENT_ROLE = 'ROLE_STUDENT'

const STATUS_FILTER_OPTIONS = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'green' },
    { value: 'INACTIVE', label: 'Đã vô hiệu hóa', tone: 'red' },
    { value: 'PENDING_VERIFICATION', label: 'Chờ xác thực email', tone: 'orange' },
]

const PENDING_STATUS = 'PENDING_VERIFICATION'

const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'green' },
    { value: 'INACTIVE', label: 'Đã vô hiệu hóa', tone: 'red' },
]

function StatCard({ icon: Icon, label, value, hint, tone, loading, failed }) {
    return (
        <div className={`adm-stat-card adm-stat-card--${tone}`}>
            <span className="adm-stat-rail" aria-hidden="true" />
            <div className="adm-stat-body">
                <span className="adm-stat-label">{label}</span>
                <span className={`adm-stat-value${loading ? ' is-loading' : ''}`}>
                    {loading || failed ? '—' : Number(value || 0).toLocaleString('vi-VN')}
                </span>
                {hint && <span className="adm-stat-hint">{hint}</span>}
            </div>
            <span className="adm-stat-icon"><Icon size={18} strokeWidth={2.2} /></span>
        </div>
    )
}

export default function StudentAccountsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Admin'

    const { toasts, showToast, dismissToast } = useCmToast()

    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')

    /* Số liệu tổng — lấy riêng vì danh sách chỉ trả về đúng một trang */
    const [stats, setStats] = useState(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [statsFailed, setStatsFailed] = useState(false)

    /* Tài khoản đang chờ xác nhận đổi trạng thái */
    const [confirmTarget, setConfirmTarget] = useState(null)
    const [pendingStatus, setPendingStatus] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [totalPages, setTotalPages] = useState(1)
    const [totalElements, setTotalElements] = useState(0)

    /* Tăng lên mỗi lần cần nạp lại — cờ loading do chính nơi bấm bật lên,
       nhờ vậy effect chỉ còn việc gọi API chứ không setState ngay trong thân */
    const [reloadToken, setReloadToken] = useState(0)

    const reload = useCallback(() => {
        setLoading(true)
        setStatsLoading(true)
        setReloadToken(t => t + 1)
    }, [])

    useEffect(() => {
        let alive = true
        getUsers({
            role: STUDENT_ROLE,
            keyword: search.trim() || undefined,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            page: currentPage - 1,
            size: pageSize,
        })
            .then(data => {
                if (!alive) return
                setStudents(data.content || [])
                setTotalPages(data.totalPages || 1)
                setTotalElements(data.totalElements || 0)
            })
            .catch(err => {
                console.error('Không tải được danh sách sinh viên:', err)
                if (alive) showToast('Không thể tải danh sách sinh viên', 'error')
            })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [search, statusFilter, currentPage, pageSize, reloadToken, showToast])

    useEffect(() => {
        let alive = true
        getUserStats(STUDENT_ROLE)
            .then(data => { if (alive) { setStats(data); setStatsFailed(false) } })
            .catch(err => {
                console.error('Không tải được số liệu tài khoản sinh viên:', err)
                // Chỉ console.error rồi để 4 thẻ render 0 = số liệu bịa (DEF_202)
                if (alive) { setStats(null); setStatsFailed(true) }
                showToast('Không tải được số liệu tài khoản sinh viên', 'error')
            })
            .finally(() => { if (alive) setStatsLoading(false) })
        return () => { alive = false }
    }, [reloadToken])

    /* UC-72: đổi trạng thái luôn phải qua bước xác nhận, vì vô hiệu hóa sẽ
       hủy toàn bộ session đang đăng nhập của sinh viên đó */
    const handleStatusSelect = (student, newStatus) => {
        if (student.status === PENDING_STATUS || newStatus === PENDING_STATUS) return
        if (newStatus === student.status) return
        setConfirmTarget(student)
        setPendingStatus(newStatus)
    }

    const closeConfirm = () => {
        setConfirmTarget(null)
        setPendingStatus(null)
    }

    const confirmToggle = async () => {
        const target = confirmTarget
        const nextStatus = pendingStatus
        const name = target.displayName || target.identifier
        setSubmitting(true)
        try {
            await updateUserStatus(target.id, nextStatus)
            showToast(
                nextStatus === 'INACTIVE'
                    ? `Đã vô hiệu hóa tài khoản ${name} — session sẽ bị hủy trong vòng 60 giây`
                    : `Đã kích hoạt lại tài khoản ${name}`,
                nextStatus === 'INACTIVE' ? 'warning' : 'success'
            )
            closeConfirm()
            reload()
        } catch (err) {
            console.error('Không cập nhật được trạng thái tài khoản:', err)
            showToast(err.response?.data?.message || 'Không thể cập nhật trạng thái tài khoản', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    /* Mọi thao tác đổi bộ lọc / phân trang đều bật cờ loading ngay tại chỗ bấm
       để bảng hiện khung chờ trong lúc gọi API */
    const handleSearchChange = (value) => {
        setLoading(true)
        setSearch(value)
        setCurrentPage(1)
    }

    const handleStatusFilterChange = (value) => {
        setLoading(true)
        setStatusFilter(value)
        setCurrentPage(1)
    }

    const handlePageChange = (page) => {
        setLoading(true)
        setCurrentPage(page)
    }

    const handlePageSizeChange = (size) => {
        setLoading(true)
        setPageSize(size)
        setCurrentPage(1)
    }

    const formatDate = (value) => {
        if (!value) return '—'
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
    }

    const activeRate = useMemo(() => {
        if (!stats?.total) return null
        return Math.round((stats.active / stats.total) * 100)
    }, [stats])

    const deactivating = pendingStatus === 'INACTIVE'

    return (
        <Layout
            role="admin"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="adm-page">

                {/* ── ĐẦU TRANG ── */}
                <header className="adm-head">
                    <div className="adm-head-main">
                        <span className="adm-head-icon"><User size={20} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="adm-title">Tài khoản sinh viên</h1>
                            <p className="adm-sub">
                                Theo dõi quy mô người dùng sinh viên và tạm khóa tài khoản vi phạm
                            </p>
                        </div>
                    </div>
                    <div className="adm-head-actions">
                        <button
                            type="button"
                            className="cm-btn cm-btn--secondary"
                            onClick={reload}
                            disabled={loading}
                        >
                            <RefreshCw size={14} strokeWidth={2.4} className={loading ? 'adm-spin' : ''} />
                            {loading ? 'Đang tải...' : 'Làm mới'}
                        </button>
                    </div>
                </header>

                {/* ── SỐ LIỆU TỔNG ── */}
                <div className="adm-stat-grid">
                    <StatCard
                        label="Tổng số sinh viên"
                        value={stats?.total}
                        hint="Toàn bộ tài khoản vai trò sinh viên"
                        icon={Users}
                        tone="blue"
                        loading={statsLoading}
                        failed={statsFailed}
                    />
                    <StatCard
                        label="Đang hoạt động"
                        value={stats?.active}
                        /* getUserStats đếm toàn hệ thống, còn totalElements là số dòng của
                           bộ lọc hiện tại — 2 con số khác nhau nên phải nói rõ (DEF_201) */
                        hint={statusFilter === 'ACTIVE'
                            ? `Toàn hệ thống · danh sách đang lọc: ${Number(totalElements).toLocaleString('vi-VN')} dòng`
                            : (activeRate !== null ? `${activeRate}% tổng số tài khoản` : undefined)}
                        icon={UserCheck}
                        tone="green"
                        loading={statsLoading}
                        failed={statsFailed}
                    />
                    <StatCard
                        label="Đã vô hiệu hóa"
                        value={stats?.inactive}
                        hint="Không thể đăng nhập cho tới khi mở lại"
                        icon={UserX}
                        tone={stats?.inactive > 0 ? 'orange' : 'teal'}
                        loading={statsLoading}
                        failed={statsFailed}
                    />
                    <StatCard
                        label="Đăng ký trong tháng"
                        value={stats?.newThisMonth}
                        hint="Tính từ ngày đầu tháng hiện tại"
                        icon={CalendarPlus}
                        tone="purple"
                        loading={statsLoading}
                        failed={statsFailed}
                    />
                </div>

                {/* ── DANH SÁCH ── */}
                <div className="adm-card">
                    <div className="adm-card-head">
                        <span className="adm-card-icon"><Users size={18} strokeWidth={2.2} /></span>
                        <div className="adm-card-titles">
                            <h3 className="adm-card-title">Danh sách tài khoản sinh viên</h3>
                            <p className="adm-card-sub">Tìm theo họ tên hoặc email, lọc theo trạng thái đăng nhập</p>
                        </div>
                    </div>

                    <div className="adm-cb">
                        <div className="adm-toolbar">
                            <div className="adm-search">
                                <Search size={15} strokeWidth={2.4} />
                                <input
                                    placeholder="Tìm theo họ tên hoặc email..."
                                    value={search}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    aria-label="Tìm kiếm sinh viên"
                                />
                            </div>
                            <CmSelect
                                options={STATUS_FILTER_OPTIONS}
                                value={statusFilter}
                                onChange={handleStatusFilterChange}
                                placeholder="Tất cả trạng thái"
                                highlightActive={statusFilter !== 'ALL'}
                                tinted
                                width="200px"
                            />
                        </div>

                        {loading ? (
                            <div>
                                {Array.from({ length: 4 }, (_, i) => <span key={i} className="adm-skeleton-row" />)}
                            </div>
                        ) : students.length === 0 ? (
                            <div className="adm-empty">
                                <Inbox size={17} strokeWidth={2.2} />
                                <span>
                                    {search || statusFilter !== 'ALL'
                                        ? 'Không có sinh viên nào khớp bộ lọc hiện tại'
                                        : 'Chưa có tài khoản sinh viên nào trong hệ thống'}
                                </span>
                            </div>
                        ) : (
                            <div className="adm-table-wrap">
                                <table className="adm-table">
                                    <thead>
                                        <tr>
                                            <th>Họ tên / Email</th>
                                            <th>Ngày đăng ký</th>
                                            <th className="sap-th-status">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => (
                                            <tr key={student.id}>
                                                <td>
                                                    <div className="adm-user-name">{student.displayName || student.identifier}</div>
                                                    <div className="adm-user-sub">{student.identifier}</div>
                                                </td>
                                                <td className="adm-muted">{formatDate(student.createdAt)}</td>
                                                <td>
                                                    {student.status === PENDING_STATUS ? (
                                                        <div
                                                            className="cmsel-trigger cmsel-trigger--sm cmsel-tone-orange"
                                                            style={{ width: '170px', cursor: 'default', opacity: 0.85, pointerEvents: 'none' }}
                                                            title="Tài khoản chưa xác thực email (không thể chỉnh sửa trạng thái)"
                                                        >
                                                            <span className="cmsel-dot cmsel-dot--orange" />
                                                            <span className="cmsel-value">Chờ xác thực email</span>
                                                        </div>
                                                    ) : (
                                                        <CmSelect
                                                            options={STATUS_OPTIONS}
                                                            value={student.status}
                                                            onChange={(value) => handleStatusSelect(student, value)}
                                                            size="sm"
                                                            tinted
                                                            width="170px"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <CmPagination
                            page={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            totalItems={totalElements}
                            pageSize={pageSize}
                            onPageSizeChange={handlePageSizeChange}
                            itemLabel="sinh viên"
                        />
                    </div>
                </div>
            </div>

            {/* ── XÁC NHẬN ĐỔI TRẠNG THÁI ── */}
            {confirmTarget && (
                <div className="adm-modal-overlay" onClick={closeConfirm}>
                    <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="adm-modal-head">
                            <span className={`adm-modal-icon${deactivating ? ' adm-modal-icon--danger' : ' adm-modal-icon--success'}`}>
                                {deactivating
                                    ? <ShieldAlert size={19} strokeWidth={2.2} />
                                    : <ShieldCheck size={19} strokeWidth={2.2} />}
                            </span>
                            <h2 className="adm-modal-title">
                                {deactivating ? 'Vô hiệu hóa tài khoản?' : 'Kích hoạt lại tài khoản?'}
                            </h2>
                        </div>
                        <p className="adm-modal-text">
                            {deactivating
                                ? `Toàn bộ session hiện tại của ${confirmTarget.displayName || confirmTarget.identifier} sẽ bị hủy trong vòng 60 giây và tài khoản không thể đăng nhập cho đến khi được kích hoạt lại.`
                                : confirmTarget.status === PENDING_STATUS
                                    /* Tài khoản chưa xác thực email thì chưa từng đăng nhập,
                                       nói "đăng nhập lại" là sai (DEF_203) */
                                    ? `${confirmTarget.displayName || confirmTarget.identifier} chưa xác thực email nên chưa từng đăng nhập. Sau khi kích hoạt, sinh viên vẫn phải xác thực email trước khi dùng được tài khoản.`
                                    : `${confirmTarget.displayName || confirmTarget.identifier} sẽ đăng nhập lại được bình thường.`}
                        </p>
                        <div className="adm-modal-actions">
                            <button type="button" className="cm-btn cm-btn--secondary" onClick={closeConfirm} disabled={submitting}>
                                <X size={14} strokeWidth={2.4} /> Hủy
                            </button>
                            <button
                                type="button"
                                className={`cm-btn ${deactivating ? 'cm-btn--danger-solid' : 'cm-btn--success'}`}
                                onClick={confirmToggle}
                                disabled={submitting}
                            >
                                {deactivating
                                    ? <><ShieldAlert size={14} strokeWidth={2.4} /> Vô hiệu hóa</>
                                    : <><ShieldCheck size={14} strokeWidth={2.4} /> Kích hoạt lại</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}
