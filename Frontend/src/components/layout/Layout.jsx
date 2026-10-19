/**
 * Layout.jsx — SMOSP App Shell
 *
 * Props:
 *   role          'student' | 'cm' | 'admin'
 *   user          { name, avatarUrl? }
 *   breadcrumbs   [{ label, href? }]   — cuối mảng là trang hiện tại (no href)
 *   notifications [{ id, message, time, read? }]
 *   onLogoClick   fn
 *   onLogout      fn
 *   onGoHome      fn  — chỉ dùng cho student
 *   children      ReactNode
 */

import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    User,
    FileText,
    Award,
    Heart,
    Wrench,
    Sparkles,
    Compass,
    Map,
    GitBranch,
    AlertTriangle,
    AlertCircle,
    Folder,
    Home,
    LogOut,
    Star,
    Settings,
    Key,
    Bell,
    ChevronDown,
    Menu,
    Layers,
    BookOpen,
    Sliders,
    TrendingUp,
    Users,
    Check
} from 'lucide-react'
import logoSvg from '../../asset/logo.svg'
import './Layout.css'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/authService'
import { getStudentProfile, getDeclaredSkills, getDeclaredInterests, getMyGrades, getLatestTranscript } from '../../services/studentService'
import { initFcmToken } from '../../utils/fcmHelper'
import { useProfileFlow } from '../student/profileFlow'

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconBell = () => <Bell size={19} />
const IconChevron = ({ open }) => (
    <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }} />
)
const IconMenu = () => <Menu size={20} />
const IconHome = () => <Home size={15} />
const IconLogout = () => <LogOut size={15} />
const IconSettings = () => <Settings size={15} />
const IconKey = () => <Key size={15} />

// ─── Sidebar config per role ───────────────────────────────────────────────────

const SIDEBAR_MENUS = {
    student: [
        {
            label: 'Cá nhân',
            items: [
                { label: 'Tổng quan', href: '/student/dashboard', icon: LayoutDashboard },
                { label: 'Thông tin cá nhân', href: '/student/profile', icon: User, key: 'profile' },
                { label: 'Bảng điểm', href: '/student/profile/transcript', icon: FileText, key: 'transcript' },
                { label: 'Kỹ năng', href: '/student/profile/skills', icon: Wrench, key: 'skills' },
                { label: 'Sở thích', href: '/student/profile/interests', icon: Heart, key: 'interests' },
            ],
        },
        {
            label: 'Khám phá',
            items: [
                { label: 'Gợi ý chuyên ngành hẹp', href: '/student/recommendation', icon: Sparkles },
                { label: 'Lộ trình học tập', href: '/student/roadmap', icon: Compass },
            ],
        },

        {
            label: 'Báo cáo',
            items: [
                { label: 'Báo cáo lỗi nội dung', href: '/student/content-report', icon: AlertTriangle },
                { label: 'Báo cáo của tôi', href: '/student/my-reports', icon: Folder },
            ],
        },
    ],
    cm: [
        {
            label: '',
            items: [
                { label: 'Dashboard', href: '/cm/dashboard', icon: LayoutDashboard },
            ],
        },
        {
            label: 'Nội dung học thuật',
            items: [
                { label: 'Danh mục ngành học', href: '/cm/catalog', icon: Folder },
                { label: 'Khung chương trình', href: '/cm/curriculum', icon: Layers },
                { label: 'Môn học', href: '/cm/courses', icon: BookOpen },
                { label: 'Báo cáo lỗi nội dung', href: '/cm/error-reports', icon: AlertTriangle },
            ],
        },
        {
            label: 'Kỹ năng và sở thích',
            items: [
                { label: 'Kỹ năng', href: '/cm/skills', icon: Award },
                { label: 'Sở thích', href: '/cm/interests', icon: Heart },
                { label: 'Tag Map', href: '/cm/tagmap', icon: GitBranch },
            ],
        },
        {
            label: 'Trọng số đánh giá',
            items: [
                { label: 'Điều chỉnh trọng số', href: '/cm/compatibility-weight', icon: Sliders },
                { label: 'Dữ liệu tuyển dụng', href: '/cm/trending-weight', icon: TrendingUp },
            ],
        },
    ],
    admin: [
        {
            label: '',
            items: [
                { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
            ],
        },
        {
            label: 'Tài Khoản',
            items: [
                { label: 'Tài khoản quản lý nội dung', href: '/admin/cm-accounts', icon: Users },
                { label: 'Tài khoản Sinh viên', href: '/admin/student-accounts', icon: User },
            ],
        },
        {
            label: 'Cấu hình',
            items: [
                { label: 'Cấu hình thu thập dữ liệu', href: '/admin/crawler', icon: Settings },
                { label: 'Cấu hình bảng điểm', href: '/admin/transcript-presets', icon: FileText },
            ],
        },
        {
            label: 'Báo cáo',
            items: [
                { label: 'Xử lý báo cáo', href: '/admin/reports', icon: AlertTriangle },
            ],
        },
    ],
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Layout({
    role = 'student',
    user = { name: 'Người dùng' },
    breadcrumbs = [],
    onLogout,
    onGoHome,
    onLogoClick,
    children,
}) {
    const navigate = useNavigate()
    const [bellOpen, setBellOpen] = useState(false)
    const [avatarOpen, setAvatarOpen] = useState(false)
    const [notifList, setNotifList] = useState([])
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [missingStatus, setMissingStatus] = useState({
        profile: false,
        transcript: false,
        skills: false,
        interests: false,
    })

    const bellRef = useRef(null)
    const avatarRef = useRef(null)
    const location = useLocation()

    const unreadCount = notifList.filter((n) => !n.isRead).length

    const { completion } = useProfileFlow(null)

    // Check student profile completeness
    useEffect(() => {
        if (role !== 'student' || !completion) return;

        setMissingStatus({
            profile: !completion.personalInfo,
            transcript: !completion.transcript,
            skills: !completion.skills,
            interests: !completion.interests,
        });
    }, [role, completion]);

    // Fetch notifications & sync FCM token on layout mount
    useEffect(() => {
        initFcmToken();
        const fetchNotifs = async () => {
            try {
                const data = await getNotifications();
                setNotifList(data);
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
            }
        };
        fetchNotifs();
        // Poll every 30 seconds for new notifications
        const interval = setInterval(fetchNotifs, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
            if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const markAllRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifList((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch (err) {
            console.error("Failed to mark all as read:", err);
        }
    };

    const markRead = async (id) => {
        try {
            await markNotificationAsRead(id);
            setNotifList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error("Failed to mark notification as read:", err);
        }
    };

    const handleNotifClick = async (n) => {
        if (!n.isRead) {
            await markRead(n.id);
        }
        setBellOpen(false);
        if (n.type === 'REPORT_STATUS_CHANGED') {
            if (role === 'cm') navigate('/cm/error-reports');
            else if (role === 'admin') navigate('/admin/reports');
            else navigate('/student/my-reports');
        } else if (n.type === 'SKILL_REMOVED') {
            navigate('/student/profile/skills');
        } else if (n.type === 'INTEREST_REMOVED') {
            navigate('/student/profile/interests');
        }
    };

    const timeAgo = (dateStr) => {
        if (!dateStr) return "";
        try {
            const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
            if (seconds < 60) return "Vừa xong";
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes} phút trước`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours} giờ trước`;
            const days = Math.floor(hours / 24);
            return `${days} ngày trước`;
        } catch {
            return "";
        }
    };

    const menus = SIDEBAR_MENUS[role] || SIDEBAR_MENUS.student

    const roleLabel = { student: 'Sinh viên', cm: 'Content Manager', admin: 'Quản trị viên' }[role]

    // Trang gọi Layout tự quyết hành vi bấm logo qua prop onLogoClick. Nhánh
    // admin/cm đứng trước khiến prop bị bỏ qua hoàn toàn ở SCR-36 và SCR-38 (DEF_193).
    const handleLogoClick = (e) => {
        if (onLogoClick) {
            onLogoClick(e)
        } else if (role === 'admin') {
            navigate('/admin/dashboard')
        } else if (role === 'cm') {
            navigate('/cm/dashboard')
        } else {
            navigate('/')
        }
    }

    return (
        <div className={`smosp-layout smosp-layout--${role}`}>

            {/* ── TOPBAR ── */}
            <header className="smosp-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        className="smosp-topbar-icon-btn smosp-sidebar-toggle-btn"
                        onClick={() => setSidebarCollapsed(prev => !prev)}
                        aria-label="Ẩn/Hiện Menu"
                        title={sidebarCollapsed ? "Hiện sidebar" : "Ẩn sidebar"}
                    >
                        <IconMenu />
                    </button>
                    <button className="smosp-topbar-logo" onClick={handleLogoClick} aria-label="SMOSP — về trang chủ">
                        <img src={logoSvg} alt="SMOSP" className="smosp-topbar-logo-img" />
                        <span className="smosp-topbar-logo-text">SMOSP</span>
                    </button>
                </div>

                {role === 'student' && (
                    <div className="smosp-topbar-links">
                        <Link to="/student/dashboard" className={`smosp-topbar-link${location.pathname === '/student/dashboard' ? ' active' : ''}`}>Tổng quan</Link>
                        <Link to="/" className={`smosp-topbar-link${location.pathname === '/' ? ' active' : ''}`}>Trang chủ</Link>
                        <Link to="/major-catalog" className={`smosp-topbar-link${location.pathname.startsWith('/major-catalog') || location.pathname.startsWith('/catalog') ? ' active' : ''}`}>Mục lục ngành</Link>
                    </div>
                )}

                <div className="smosp-topbar-right">


                    {/* Bell */}
                    <div className="smosp-topbar-bell-wrap" ref={bellRef}>
                        <button
                            className="smosp-topbar-icon-btn"
                            onClick={() => { setBellOpen((v) => !v); setAvatarOpen(false) }}
                            aria-label="Thông báo"
                            aria-expanded={bellOpen}
                        >
                            <IconBell />
                            {unreadCount > 0 && (
                                <span className="smosp-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>

                        {bellOpen && (
                            <div className="smosp-notif-dropdown" role="dialog" aria-label="Danh sách thông báo">
                                <div className="smosp-notif-header">
                                    <span className="smosp-notif-title">Thông báo</span>
                                    {unreadCount > 0 && (
                                        <button className="smosp-notif-mark-all" onClick={markAllRead}>
                                            Đánh dấu tất cả đã đọc
                                        </button>
                                    )}
                                </div>
                                <div className="smosp-notif-list">
                                    {notifList.length === 0 ? (
                                        <div className="smosp-notif-empty">Không có thông báo nào</div>
                                    ) : (
                                        notifList.map((n) => (
                                            <div
                                                key={n.id}
                                                className={`smosp-notif-item${n.isRead ? '' : ' unread'}`}
                                                onClick={() => handleNotifClick(n)}
                                            >
                                                {!n.isRead && <span className="smosp-notif-dot" />}
                                                <div className="smosp-notif-body">
                                                    <p className="smosp-notif-msg">
                                                        <strong>{n.title}</strong>: {n.body}
                                                    </p>
                                                    <span className="smosp-notif-time">{timeAgo(n.createdAt)}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Avatar */}
                    <div className="smosp-topbar-avatar-wrap" ref={avatarRef}>
                        <button
                            className="smosp-topbar-avatar-btn"
                            onClick={() => { setAvatarOpen((v) => !v); setBellOpen(false) }}
                            aria-label={`Tài khoản: ${user.name}`}
                            aria-expanded={avatarOpen}
                        >
                            {user.avatarUrl
                                ? <img src={user.avatarUrl} alt={user.name} className="smosp-avatar-img" />
                                : <span className="smosp-avatar-initials">{user.name.charAt(0).toUpperCase()}</span>
                            }
                            <IconChevron open={avatarOpen} />
                        </button>

                        {avatarOpen && (
                            <div className="smosp-avatar-dropdown" role="menu">
                                <div className="smosp-avatar-dropdown-header">
                                    <div className="smosp-avatar-dropdown-avatar">
                                        {user.avatarUrl
                                            ? <img src={user.avatarUrl} alt={user.name} className="smosp-avatar-img" />
                                            : <span className="smosp-avatar-initials">{user.name.charAt(0).toUpperCase()}</span>
                                        }
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <p className="smosp-avatar-name">{user.name}</p>
                                        <p className="smosp-avatar-role">{roleLabel}</p>
                                    </div>
                                </div>
                                <div className="smosp-avatar-dropdown-divider" />
                                <Link to="/settings/account" className="smosp-avatar-menu-item" role="menuitem">
                                    <IconSettings /> Thiết lập tài khoản
                                </Link>
                                <Link to="/settings/password" className="smosp-avatar-menu-item" role="menuitem">
                                    <IconKey /> Đổi mật khẩu
                                </Link>
                                <div className="smosp-avatar-dropdown-divider" />
                                <button className="smosp-avatar-menu-item danger" role="menuitem" onClick={onLogout}>
                                    <IconLogout /> Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── BODY ── */}
            <div className="smosp-body">

                {/* Sidebar */}
                <aside className={`smosp-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
                    <nav className="smosp-sidebar-nav">
                        {menus.map((group) => (
                            <div key={group.label} className="smosp-sidebar-group">
                                <span className="smosp-sidebar-group-label">{group.label}</span>
                                {group.items.map((item) => {
                                    const isSpecial = item.href === '/student/recommendation';
                                    const ItemIcon = item.icon;
                                    const isStudentCheckItem = role === 'student' && item.key && missingStatus[item.key] !== undefined;
                                    const isMissing = isStudentCheckItem && missingStatus[item.key];
                                    const isDone = isStudentCheckItem && !missingStatus[item.key];
                                    const isActive = item.href === '/student/recommendation' 
                                        ? location.pathname.startsWith('/student/recommendation')
                                        : location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            className={`smosp-sidebar-item${isActive ? ' active' : ''}${isSpecial ? ' smosp-sidebar-item-special' : ''}${isMissing ? ' smosp-sidebar-item-missing' : ''}`}
                                        >
                                            {ItemIcon && (
                                                <span className="smosp-sidebar-item-icon">
                                                    <ItemIcon />
                                                </span>
                                            )}
                                            <span className="smosp-sidebar-item-text">{item.label}</span>
                                            {isDone && (
                                                <span className="smosp-sidebar-status-badge smosp-sidebar-status-badge--done" title="Đã hoàn thành mục này">
                                                    <Check size={12} strokeWidth={3.2} />
                                                </span>
                                            )}
                                            {isMissing && (
                                                <span className="smosp-sidebar-status-badge smosp-sidebar-status-badge--missing" title="Chưa khai báo mục này">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="4.5" x2="12" y2="12" strokeWidth="5" />
                                                        <circle cx="12" cy="19" r="2.2" fill="currentColor" stroke="none" />
                                                    </svg>
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>

                    <div className="smosp-sidebar-bottom">
                        {/* Trang chủ là màn công khai, mọi vai đều xem được — khoá cứng
                            role === 'student' khiến Admin/CM không có lối về (DEF_199) */}
                        <button className="smosp-sidebar-home-btn" onClick={onGoHome || (() => navigate('/'))}>
                            <IconHome />
                            <span className="smosp-sidebar-home-btn-text">Về trang chủ</span>
                        </button>
                        <button className="smosp-sidebar-logout-btn" onClick={onLogout}>
                            <IconLogout />
                            <span className="smosp-sidebar-logout-btn-text">Đăng xuất</span>
                        </button>
                    </div>
                </aside>

                {/* Main */}
                <main className="smosp-main">
                    {role === 'student' && (
                        <div className="smosp-bg-decorations" aria-hidden="true">
                            {/* Blobs */}
                            <div className="decor-shape decor-blob-1"></div>
                            <div className="decor-shape decor-blob-2"></div>
                            <div className="decor-shape decor-blob-3"></div>
                            <div className="decor-shape decor-blob-4"></div>
                            <div className="decor-shape decor-blob-5"></div>

                            {/* Rings */}
                            <div className="decor-shape decor-ring-1"></div>
                            <div className="decor-shape decor-ring-2"></div>
                            {/* Floating Glassmorphic Cards/Pills (Various Sizes) */}
                            <div className="decor-glass decor-glass-1"></div>
                            <div className="decor-glass decor-glass-2"></div>
                            <div className="decor-glass decor-glass-3"></div>

                            {/* Tech Square Outlines */}
                            <div className="decor-square decor-square-1"></div>
                            <div className="decor-square decor-square-2"></div>
                            <div className="decor-square decor-square-3"></div>

                            {/* Academic Floating Icons */}
                            <div className="decor-academic decor-academic-book">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                            </div>
                            <div className="decor-academic decor-academic-cap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" /></svg>
                            </div>
                            <div className="decor-academic decor-academic-computer">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="20" x2="22" y2="20" /><line x1="12" y1="17" x2="12" y2="20" /></svg>
                            </div>
                            <div className="decor-academic decor-academic-search">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            </div>
                        </div>
                    )}

                    {role !== 'cm' && role !== 'admin' && breadcrumbs.length > 0 && (
                        <nav className="smosp-breadcrumb" aria-label="Breadcrumb">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <span className="smosp-breadcrumb-sep">›</span>}
                                    {crumb.href && idx < breadcrumbs.length - 1
                                        ? <Link to={crumb.href} className="smosp-breadcrumb-link">{crumb.label}</Link>
                                        : <span className="smosp-breadcrumb-current">{crumb.label}</span>
                                    }
                                </React.Fragment>
                            ))}
                        </nav>
                    )}

                    <div className="smosp-content">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}

/* ── Usage ───────────────────────────────────────────────────────
 *
 * import Layout from '@/shared/components/Layout/Layout'
 *
 * <Layout
 *   role="student"
 *   user={{ name: 'Nguyễn Văn A' }}
 *   breadcrumbs={[
 *     { label: 'Dashboard', href: '/student/dashboard' },
 *     { label: 'Gợi ý chuyên ngành' },
 *   ]}
 *   notifications={[
 *     { id: '1', message: 'Lộ trình của bạn đã được cập nhật', time: '2 phút trước', read: false },
 *   ]}
 *   onLogoClick={() => navigate('/')}
 *   onLogout={() => { logout(); navigate('/login') }}
 *   onGoHome={() => navigate('/')}
 * >
 *   <YourPage />
 * </Layout>
 */