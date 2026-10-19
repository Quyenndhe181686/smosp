import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    UserCog, Search, Users, UserCheck, UserX, CalendarPlus, UserPlus,
    RefreshCw, KeyRound, AlertTriangle, Info, X, Check, Inbox
} from 'lucide-react'
import { logout } from '../../services/authService'
import { getUsers, getUserStats, updateUserStatus, resetUserPassword, createStaffAccount } from '../../services/userService'
import Layout from '../../components/layout/Layout'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './admin-ui.css'
import './CmAccountsPage.css'

const CM_ROLE = 'ROLE_CONTENT_MANAGER'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128 // BV-05

const STATUS_FILTER_OPTIONS = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'green' },
    { value: 'INACTIVE', label: 'Đã vô hiệu hóa', tone: 'red' },
]

const ROLE_FILTER_OPTIONS = [
    { value: 'ROLE_CONTENT_MANAGER', label: 'Content Manager' },
    { value: 'ROLE_ADMIN', label: 'Admin' }
]

const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'green' },
    { value: 'INACTIVE', label: 'Đã vô hiệu hóa', tone: 'red' },
]

function validatePassword(password) {
    if (!password) return 'Password tạm thời là bắt buộc' // NAC-45-03
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
        return `Password phải từ ${PASSWORD_MIN}-${PASSWORD_MAX} ký tự` // BV-05
    }
    // BV-05/GBV-01: đủ 4 nhóm ký tự, khớp với @Pattern ở CreateStaffRequest.
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)
        || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return 'Password cần ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt'
    }
    return null
}

function StatCard({ icon: Icon, label, value, hint, tone, loading, failed }) {
    return (
        <div className={`adm-stat-card adm-stat-card--${tone}`}>
            <span className="adm-stat-rail" aria-hidden="true" />
            <div className="adm-stat-body">
                <span className="adm-stat-label">{label}</span>
                <span className={`adm-stat-value${loading ? ' is-loading' : ''}`}>
                    {/* Lỗi tải mà hiện 0 thì Admin đọc như số liệu thật (DEF_197) */}
                    {loading || failed ? '—' : Number(value || 0).toLocaleString('vi-VN')}
                </span>
                {failed && !loading
                    ? <span className="adm-stat-hint">Chưa đọc được số liệu — thao tác vô hiệu hoá tạm khoá</span>
                    : (hint && <span className="adm-stat-hint">{hint}</span>)}
            </div>
            <span className="adm-stat-icon"><Icon size={18} strokeWidth={2.2} /></span>
        </div>
    )
}

export default function CMAccountsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Admin'
    const userRole = localStorage.getItem('role')
    const isSuperAdmin = userRole === 'ROLE_SUPER_ADMIN'

    const { toasts, showToast, dismissToast } = useCmToast()

    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [roleFilter, setRoleFilter] = useState('ROLE_CONTENT_MANAGER')

    /* Số liệu tổng — lấy riêng vì danh sách chỉ trả về đúng một trang */
    const [stats, setStats] = useState(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [statsFailed, setStatsFailed] = useState(false)
    const [disableTarget, setDisableTarget] = useState(null)
    const [detailAccount, setDetailAccount] = useState(null)

    /* Bảng phụ bên phải: tạo tài khoản hoặc cấp lại mật khẩu */
    const [panel, setPanel] = useState(null) // null | { type: 'create' } | { type: 'reset', account }
    const [createForm, setCreateForm] = useState({ username: '', fullName: '', tempPassword: '' })
    const [resetPassword, setResetPassword] = useState('')
    const [formError, setFormError] = useState(null)
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
            role: roleFilter,
            keyword: search.trim() || undefined,
            status: statusFilter === 'ALL' ? undefined : statusFilter,
            page: currentPage - 1,
            size: pageSize,
        })
            .then(data => {
                if (!alive) return
                setAccounts(data.content || [])
                setTotalPages(data.totalPages || 1)
                setTotalElements(data.totalElements || 0)
            })
            .catch(err => {
                console.error('Không tải được danh sách tài khoản CM:', err)
                if (alive) showToast('Không thể tải danh sách tài khoản Content Manager', 'error')
            })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [search, statusFilter, currentPage, pageSize, reloadToken, roleFilter, showToast])

    useEffect(() => {
        let alive = true
        getUserStats(roleFilter)
            .then(data => { if (alive) { setStats(data); setStatsFailed(false) } })
            .catch(err => {
                console.error('Không tải được số liệu tài khoản CM:', err)
                // stats = null làm guard BR-20 (`stats && ...`) bị bỏ qua hoàn toàn,
                // Admin có thể tắt hết CM (DEF_197)
                if (alive) { setStats(null); setStatsFailed(true) }
            })
            .finally(() => { if (alive) setStatsLoading(false) })
        return () => { alive = false }
    }, [roleFilter, reloadToken])

    /* UC-72: BR-20 — hệ thống luôn phải còn ít nhất một CM đang hoạt động.
       Kiểm tra trên số liệu toàn hệ thống, không phải trên trang đang xem. */
    const handleStatusChange = async (account, newStatus) => {
        if (newStatus === account.status) return
        // Vô hiệu hoá tài khoản là thao tác ảnh hưởng đăng nhập của người khác,
        // phải xác nhận trước khi bắn PATCH (DEF_198)
        if (newStatus === 'INACTIVE') {
            setDisableTarget(account)
            return
        }
        await applyStatusChange(account, newStatus)
    }

    const applyStatusChange = async (account, newStatus) => {
        if (newStatus === 'INACTIVE') {
            // Fail-safe: không đọc được số CM đang hoạt động thì KHÔNG cho tắt,
            // thay vì bỏ qua guard như trước (DEF_197)
            if (!stats) {
                showToast(
                    'Chưa đọc được số lượng tài khoản đang hoạt động nên tạm khoá thao tác vô hiệu hoá. Hãy bấm Làm mới rồi thử lại.',
                    'error'
                )
                return
            }
            if (stats.active <= 1) {
                showToast('Cần giữ ít nhất 1 tài khoản đang hoạt động', 'warning')
                return
            }
        }
        try {
            await updateUserStatus(account.id, newStatus)
            showToast(
                newStatus === 'INACTIVE'
                    ? `Đã vô hiệu hóa tài khoản ${account.identifier}`
                    : `Đã kích hoạt lại tài khoản ${account.identifier}`,
                newStatus === 'INACTIVE' ? 'warning' : 'success'
            )
            reload()
        } catch (err) {
            console.error('Không cập nhật được trạng thái tài khoản:', err)
            showToast(err.response?.data?.message || 'Không thể cập nhật trạng thái tài khoản', 'error')
        }
    }

    const openCreatePanel = () => {
        setPanel({ type: 'create' })
        setCreateForm({ username: '', fullName: '', tempPassword: '' })
        setFormError(null)
    }

    const openResetPanel = (account) => {
        setPanel({ type: 'reset', account })
        setResetPassword('')
        setFormError(null)
    }

    const closePanel = () => {
        setPanel(null)
        setFormError(null)
    }

    /* UC-74: tạo tài khoản nhân sự — AC-45-01..05 */
    const handleCreateSubmit = async (e) => {
        e.preventDefault()
        const name = createForm.username.trim()
        if (!name) return setFormError('Username là bắt buộc')
        if (!createForm.fullName.trim()) return setFormError('Họ tên là bắt buộc')
        const passwordError = validatePassword(createForm.tempPassword) // AC-45-03
        if (passwordError) return setFormError(passwordError)

        setSubmitting(true)
        try {
            await createStaffAccount({
                username: name,
                displayName: createForm.fullName.trim(),
                password: createForm.tempPassword,
            })
            closePanel()
            setCreateForm({ username: '', fullName: '', tempPassword: '' })
            showToast(
                `Đã tạo tài khoản ${name}. Đây là mật khẩu tạm — nhân sự bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên trước khi dùng được hệ thống.`,
                'success'
            )
            reload()
        } catch (err) {
            console.error('Không tạo được tài khoản nhân sự:', err)
            setFormError(err.response?.data?.message || 'Không thể tạo tài khoản Content Manager')
        } finally {
            setSubmitting(false)
        }
    }

    /* UC-73: cấp password tạm thời mới — AC-44-06 */
    const handleResetSubmit = async (e) => {
        e.preventDefault()
        const passwordError = validatePassword(resetPassword)
        if (passwordError) return setFormError(passwordError)

        setSubmitting(true)
        try {
            await resetUserPassword(panel.account.id, resetPassword)
            showToast(`Đã cấp password tạm thời mới cho ${panel.account.identifier}`, 'success')
            closePanel()
            setResetPassword('')
            reload()
        } catch (err) {
            console.error('Không đặt lại được mật khẩu:', err)
            setFormError(err.response?.data?.message || 'Không thể đặt lại mật khẩu')
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

    const handleRoleFilterChange = (value) => {
        setLoading(true)
        setRoleFilter(value)
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
                        <span className="adm-head-icon"><Users size={20} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="adm-title">
                                {roleFilter === 'ROLE_ADMIN' ? 'Tài khoản Admin' : 'Tài khoản Content Manager'}
                            </h1>
                            <p className="adm-sub">
                                {roleFilter === 'ROLE_ADMIN'
                                    ? 'Xem danh sách quản trị viên, cấp lại mật khẩu và tạm khóa khi cần'
                                    : 'Cấp tài khoản cho nhân sự quản lý nội dung, cấp lại mật khẩu và tạm khóa khi cần'
                                }
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
                        <button type="button" className="cm-btn cm-btn--primary" onClick={openCreatePanel} disabled={roleFilter === 'ROLE_ADMIN'} style={{ display: roleFilter === 'ROLE_ADMIN' ? 'none' : 'flex' }}>
                            <UserPlus size={14} strokeWidth={2.4} /> Tạo tài khoản CM
                        </button>
                    </div>
                </header>

                {/* ── SỐ LIỆU TỔNG ── */}
                <div className="adm-stat-grid">
                    <StatCard
                        label={`Tổng số ${roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'}`}
                        value={stats?.total}
                        hint={`Toàn bộ tài khoản vai trò ${roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'}`}
                        icon={Users}
                        tone="blue"
                        loading={statsLoading}
                    />
                    <StatCard
                        label="Đang hoạt động"
                        value={stats?.active}
                        failed={statsFailed}
                        hint={activeRate !== null ? `${activeRate}% tổng số tài khoản` : undefined}
                        icon={UserCheck}
                        tone="green"
                        loading={statsLoading}
                    />
                    <StatCard
                        label="Đã vô hiệu hóa"
                        value={stats?.inactive}
                        hint="Không thể đăng nhập cho tới khi mở lại"
                        icon={UserX}
                        tone={stats?.inactive > 0 ? 'orange' : 'teal'}
                        loading={statsLoading}
                    />
                    <StatCard
                        label="Tạo mới trong tháng"
                        value={stats?.newThisMonth}
                        hint="Tính từ ngày đầu tháng hiện tại"
                        icon={CalendarPlus}
                        tone="purple"
                        loading={statsLoading}
                    />
                </div>

                {/* ── DANH SÁCH + BẢNG PHỤ ── */}
                <div className="adm-split">
                    <div className="adm-split-main">
                        <div className="adm-card">
                            <div className="adm-card-head">
                                <span className="adm-card-icon"><Users size={18} strokeWidth={2.2} /></span>
                                <div className="adm-card-titles">
                                    <h3 className="adm-card-title">Danh sách tài khoản {roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'}</h3>
                                    <p className="adm-card-sub">Tìm theo username hoặc họ tên, lọc theo trạng thái đăng nhập</p>
                                </div>
                            </div>

                            <div className="adm-cb">
                                <div className="adm-toolbar">
                                    <div className="adm-search">
                                        <Search size={15} strokeWidth={2.4} />
                                        <input
                                            placeholder="Tìm theo username hoặc họ tên..."
                                            value={search}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            aria-label={`Tìm kiếm tài khoản ${roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'}`}
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
                                    {isSuperAdmin && (
                                        <CmSelect
                                            options={ROLE_FILTER_OPTIONS}
                                            value={roleFilter}
                                            onChange={handleRoleFilterChange}
                                            placeholder="Chọn vai trò"
                                            tinted
                                            width="200px"
                                        />
                                    )}
                                </div>

                                {loading ? (
                                    <div>
                                        {Array.from({ length: 4 }, (_, i) => <span key={i} className="adm-skeleton-row" />)}
                                    </div>
                                ) : accounts.length === 0 ? (
                                    <div className="adm-empty">
                                        <Inbox size={17} strokeWidth={2.2} />
                                        <span>
                                            {search || statusFilter !== 'ALL'
                                                ? 'Không có tài khoản nào khớp bộ lọc hiện tại'
                                                : `Chưa có tài khoản ${roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'} nào`}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="adm-table-wrap">
                                        <table className="adm-table">
                                            <thead>
                                                <tr>
                                                    <th>Họ tên / Username</th>
                                                    <th>Ngày tạo</th>
                                                    <th className="cma-th-status">Trạng thái</th>
                                                    <th className="adm-th-right">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accounts.map((account) => (
                                                    <tr
                                                        key={account.id}
                                                        /* FDS hứa bấm hàng mở panel chi tiết — trước đây <tr> không có onClick (DEF_194) */
                                                        onClick={() => setDetailAccount(account)}
                                                        style={{ cursor: 'pointer' }}
                                                        title="Bấm để xem chi tiết tài khoản"
                                                    >
                                                        <td>
                                                            <div className="adm-user-name">
                                                                {account.displayName || account.identifier}
                                                                {/* Tài khoản mới tạo còn dùng mật khẩu tạm (DEF_195) */}
                                                                {account.forceChangePassword && (
                                                                    <span className="cm-tag cm-tag--orange" style={{ marginLeft: 8 }}>
                                                                        Chưa đổi mật khẩu lần đầu
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="adm-user-sub">{account.identifier}</div>
                                                        </td>
                                                        <td className="adm-muted">{formatDate(account.createdAt)}</td>
                                                        <td>
                                                            <CmSelect
                                                                options={STATUS_OPTIONS}
                                                                value={account.status}
                                                                onChange={(value) => handleStatusChange(account, value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                size="sm"
                                                                tinted
                                                                width="170px"
                                                            />
                                                        </td>
                                                        <td className="adm-td-right">
                                                            <div className="adm-row-actions">
                                                                <button
                                                                    type="button"
                                                                    className="cm-btn cm-btn--secondary cm-btn--sm"
                                                                    onClick={(e) => { e.stopPropagation(); openResetPanel(account) }}
                                                                    title={`Cấp password tạm thời mới cho ${account.identifier}`}
                                                                >
                                                                    <KeyRound size={13} strokeWidth={2.4} /> Cấp lại mật khẩu
                                                                </button>
                                                            </div>
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
                                    itemLabel="tài khoản"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── BẢNG PHỤ BÊN PHẢI ── */}
                    {panel && (
                        <aside className="adm-panel">
                            <button type="button" className="adm-panel-close" onClick={closePanel} aria-label="Đóng bảng">
                                <X size={15} strokeWidth={2.4} />
                            </button>

                            {panel.type === 'create' ? (
                                <form onSubmit={handleCreateSubmit}>
                                    <div className="adm-panel-head">
                                        <span className="adm-card-icon"><UserPlus size={18} strokeWidth={2.2} /></span>
                                        <h2 className="adm-panel-title">Tạo tài khoản CM</h2>
                                    </div>

                                    <div className="adm-field">
                                        <label className="adm-field-label" htmlFor="cma-username">Username</label>
                                        <input
                                            id="cma-username"
                                            className="adm-input"
                                            value={createForm.username}
                                            onChange={(e) => setCreateForm(f => ({ ...f, username: e.target.value }))}
                                            placeholder="vd: cm_newuser"
                                        />
                                    </div>

                                    <div className="adm-field">
                                        <label className="adm-field-label" htmlFor="cma-fullname">Họ tên</label>
                                        <input
                                            id="cma-fullname"
                                            className="adm-input"
                                            value={createForm.fullName}
                                            onChange={(e) => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                                            placeholder="Họ và tên đầy đủ"
                                        />
                                    </div>

                                    <div className="adm-field">
                                        <label className="adm-field-label" htmlFor="cma-password">Password tạm thời</label>
                                        <input
                                            id="cma-password"
                                            className="adm-input"
                                            type="password"
                                            autoComplete="new-password"
                                            value={createForm.tempPassword}
                                            onChange={(e) => setCreateForm(f => ({ ...f, tempPassword: e.target.value }))}
                                            placeholder={`${PASSWORD_MIN}-${PASSWORD_MAX} ký tự, gồm hoa, thường, số, ký tự đặc biệt`}
                                        />
                                    </div>

                                    {formError && (
                                        <div className="adm-form-error">
                                            <AlertTriangle size={14} strokeWidth={2.4} />
                                            <span>{formError}</span>
                                        </div>
                                    )}

                                    <p className="adm-form-note">
                                        <Info size={13} strokeWidth={2.4} />
                                        <span>Tài khoản được kích hoạt ngay và bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.</span>
                                    </p>

                                    <div className="adm-form-actions">
                                        <button type="submit" className="cm-btn cm-btn--primary cm-btn--block" disabled={submitting}>
                                            <Check size={14} strokeWidth={2.6} /> {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                                        </button>
                                        <button type="button" className="cm-btn cm-btn--secondary cm-btn--block" onClick={closePanel} disabled={submitting}>
                                            <X size={14} strokeWidth={2.4} /> Hủy
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleResetSubmit}>
                                    <div className="adm-panel-head">
                                        <span className="adm-card-icon adm-card-icon--orange"><KeyRound size={18} strokeWidth={2.2} /></span>
                                        <h2 className="adm-panel-title">Cấp lại mật khẩu</h2>
                                    </div>

                                    <div className="adm-panel-target">
                                        <UserCog size={14} strokeWidth={2.2} />
                                        <span>Tài khoản <strong>{panel.account.identifier}</strong></span>
                                    </div>

                                    <div className="adm-field">
                                        <label className="adm-field-label" htmlFor="cma-reset-password">Password tạm thời mới</label>
                                        <input
                                            id="cma-reset-password"
                                            className="adm-input"
                                            type="password"
                                            autoComplete="new-password"
                                            value={resetPassword}
                                            onChange={(e) => setResetPassword(e.target.value)}
                                            placeholder={`${PASSWORD_MIN}-${PASSWORD_MAX} ký tự, gồm hoa, thường, số, ký tự đặc biệt`}
                                        />
                                    </div>

                                    {formError && (
                                        <div className="adm-form-error">
                                            <AlertTriangle size={14} strokeWidth={2.4} />
                                            <span>{formError}</span>
                                        </div>
                                    )}

                                    <p className="adm-form-note">
                                        <Info size={13} strokeWidth={2.4} />
                                        <span>Người dùng bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp.</span>
                                    </p>

                                    <div className="adm-form-actions">
                                        <button type="submit" className="cm-btn cm-btn--primary cm-btn--block" disabled={submitting}>
                                            <KeyRound size={14} strokeWidth={2.4} /> {submitting ? 'Đang cấp...' : 'Cấp mật khẩu'}
                                        </button>
                                        <button type="button" className="cm-btn cm-btn--secondary cm-btn--block" onClick={closePanel} disabled={submitting}>
                                            <X size={14} strokeWidth={2.4} /> Hủy
                                        </button>
                                    </div>
                                </form>
                            )}
                        </aside>
                    )}
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />

            {disableTarget && (
                <div className="course-modal-overlay" onClick={() => setDisableTarget(null)}>
                    <div className="course-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="course-modal-title">Vô hiệu hoá tài khoản này?</div>
                        <p className="course-modal-text">
                            <strong>{disableTarget.displayName || disableTarget.identifier}</strong> sẽ không đăng nhập được
                            cho tới khi được kích hoạt lại. Mọi công việc {roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'} đang làm dở sẽ bị gián đoạn.
                        </p>
                        <div className="course-modal-actions">
                            <button type="button" className="cm-btn cm-btn--secondary" onClick={() => setDisableTarget(null)}>Không</button>
                            <button
                                type="button"
                                className="cm-btn cm-btn--danger"
                                onClick={() => { const t = disableTarget; setDisableTarget(null); applyStatusChange(t, 'INACTIVE') }}
                            >
                                Xác nhận vô hiệu hoá
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {detailAccount && (
                <div className="course-modal-overlay" onClick={() => setDetailAccount(null)}>
                    <div className="course-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="course-modal-title" style={{ color: '#034EA2' }}>Chi tiết tài khoản</div>
                        <div className="adm-srow"><span>Họ tên</span><strong>{detailAccount.displayName || '—'}</strong></div>
                        <div className="adm-srow"><span>Username</span><strong>{detailAccount.identifier}</strong></div>
                        <div className="adm-srow"><span>Vai trò</span><strong>{roleFilter === 'ROLE_ADMIN' ? 'Admin' : 'Content Manager'}</strong></div>
                        <div className="adm-srow"><span>Trạng thái</span><strong>{detailAccount.status}</strong></div>
                        <div className="adm-srow"><span>Ngày tạo</span><strong>{formatDate(detailAccount.createdAt)}</strong></div>
                        <div className="adm-srow">
                            <span>Mật khẩu lần đầu</span>
                            <strong>{detailAccount.forceChangePassword ? 'Chưa đổi (đang dùng mật khẩu tạm)' : 'Đã đổi'}</strong>
                        </div>
                        <div className="course-modal-actions" style={{ marginTop: 16 }}>
                            <button type="button" className="cm-btn cm-btn--secondary" onClick={() => setDetailAccount(null)}>Đóng</button>
                            <button
                                type="button"
                                className="cm-btn cm-btn--primary"
                                onClick={() => { const a = detailAccount; setDetailAccount(null); openResetPanel(a) }}
                            >
                                Cấp lại mật khẩu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
