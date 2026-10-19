/**
 * Navbar.jsx — SMOSP Design System
 *
 * Navbar màu blue #034EA2.
 * Logo dot màu cam #F37021.
 * Active link màu cam #F37021.
 * CTA button màu cam #F37021.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import logoSvg from '../../asset/logo.svg'
import { logout, getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/authService'

// ─── SVGs ───────────────────────────────────────────────────────────────────
const IconBell = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const IconChevron = ({ open }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IconKey = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2L14.6 8.4A5.5 5.5 0 1 0 16 10L22 4z" />
    <path d="M17 11l1-1M19.5 8.5l1.5-1.5M16 12l3-3" />
  </svg>
)

/* ── CSS ─────────────────────────────────────────────────── */

const NAVBAR_CSS = `
  .smosp-navbar {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 64px;
    background: #034EA2;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 16px rgba(3, 78, 162, 0.25);
  }
  .smosp-nav-inner {
    max-width: 100%;
    padding: 0 48px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    box-sizing: border-box;
  }
  .smosp-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.02em;
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: 'Be Vietnam Pro', sans-serif;
  }
  .smosp-logo-img {
    height: 32px;
    width: auto;
    display: block;
  }
  .smosp-logo-text {
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    font-family: 'Be Vietnam Pro', sans-serif;
  }
  .smosp-nav-links {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 200px;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }
  .smosp-nav-link {
    color: rgba(255, 255, 255, 0.72);
    font-size: 18px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    background: none;
    border: none;
    transition: background 150ms ease, color 150ms ease;
    white-space: nowrap;
    cursor: pointer;
    text-decoration: none;
    font-family: 'Be Vietnam Pro', sans-serif;
    line-height: 1;
  }
  .smosp-nav-link:hover {
    background: rgba(255, 255, 255, 0.10);
    color: #fff;
  }
  .smosp-nav-link.active {
    color: #F37021;
    font-weight: 700;
  }
  .smosp-nav-cta {
    background: #F37021;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    height: 38px;
    padding: 0 20px;
    border: none;
    border-radius: 10px;
    transition: background 150ms ease, transform 150ms ease;
    flex-shrink: 0;
    cursor: pointer;
    font-family: 'Be Vietnam Pro', sans-serif;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .smosp-nav-cta:hover {
    background: #D4580A;
    transform: translateY(-1px);
  }
  .smosp-nav-cta:active {
    transform: translateY(0);
  }
  .smosp-nav-btn-secondary {
    background: transparent;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    height: 38px;
    padding: 0 20px;
    border: 1.5px solid rgba(255, 255, 255, 0.4);
    border-radius: 10px;
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
    flex-shrink: 0;
    cursor: pointer;
    font-family: 'Be Vietnam Pro', sans-serif;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .smosp-nav-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: #fff;
    transform: translateY(-1px);
  }
  .smosp-nav-btn-secondary:active {
    transform: translateY(0);
  }
  .smosp-nav-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .smosp-hamburger {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    cursor: pointer;
    color: #fff;
    transition: background 150ms ease;
  }
  .smosp-hamburger:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .smosp-mobile-menu {
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    background: #034EA2;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding: 12px 0 16px;
    display: flex;
    flex-direction: column;
    z-index: 49;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
  .smosp-mobile-link {
    font-family: 'Be Vietnam Pro', sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    padding: 12px 20px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background 150ms ease, color 150ms ease;
  }
  .smosp-mobile-link:hover,
  .smosp-mobile-link.active {
    background: rgba(255, 255, 255, 0.10);
    color: #fff;
  }
  @media (max-width: 768px) {
    .smosp-nav-links { display: none !important; }
    .smosp-hamburger { display: flex !important; }
    .smosp-nav-inner { padding: 0 16px; }
  }
  @media (min-width: 769px) {
    .smosp-mobile-menu { display: none !important; }
  }
`

/* ── Component ───────────────────────────────────────────── */

export default function Navbar({
  logo = '',
  links = [],
  ctaLabel = 'Bắt Đầu',
  onCtaClick,
  registerLabel = 'Đăng ký',
  onRegisterClick,
  user: propUser = null,
  onLogoClick,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const token = localStorage.getItem('accessToken')
  const storedName = localStorage.getItem('username') || localStorage.getItem('name')
  
  // Use propUser if provided, else construct from localStorage if token exists.
  // Ensures user always has a name even if data is partial (fixes DEF_XX partial session bug)
  let user = propUser;
  if (!user && token) {
    user = { name: storedName || 'Người dùng', avatarUrl: localStorage.getItem('avatarUrl') };
  } else if (user && !user.name) {
    user = { ...user, name: storedName || 'Người dùng' };
  }

  // Bell & Avatar Dropdown states for logged in user (matching Layout.jsx)
  const [bellOpen, setBellOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [notifList, setNotifList] = useState([])

  const bellRef = useRef(null)
  const avatarRef = useRef(null)

  const unreadCount = notifList.filter((n) => !n.isRead).length

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  // Click outside to close dropdowns
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
    } catch (e) {
      return "";
    }
  };

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const storedRole = localStorage.getItem("role")
  const role = (storedRole === "ROLE_ADMIN" || storedRole === "ROLE_SUPER_ADMIN") ? "admin" : (storedRole === "ROLE_CONTENT_MANAGER" ? "cm" : "student")
  const roleLabel = { student: 'Sinh viên', cm: 'Content Manager', admin: 'Quản trị viên' }[role]

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 769) setMenuOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (!e.target.closest('.smosp-navbar')) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  // Trang gọi Navbar tự quyết định hành vi bấm logo qua onLogoClick (vd Homepage cuộn
  // lên đầu trang). Trước đây nhánh admin/cm chặn trước nên Admin đứng ở Trang chủ
  // bấm logo lại bị đẩy sang dashboard, khác hẳn các vai còn lại (DEF_37).
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
    <>
      <style>{NAVBAR_CSS}</style>
      <nav className="smosp-navbar" style={{ position: 'sticky' }}>
        <div className="smosp-nav-inner">

          {/* Logo */}
          <button
            className="smosp-logo"
            onClick={handleLogoClick}
            aria-label="SMOSP — về trang chủ"
          >
            <img src={logoSvg} alt="SMOSP Logo" className="smosp-logo-img" />
            <span className="smosp-logo-text">SMOSP</span>
          </button>

          {/* Desktop links */}
          <div className="smosp-nav-links" role="navigation" aria-label="Điều hướng chính">
            {links.map((link) => (
              <a
                key={link.href || link.label}
                href={link.href || '#'}
                onClick={link.onClick}
                className={`smosp-nav-link${link.active ? ' active' : ''}`}
                aria-current={link.active ? 'page' : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right area */}
          <div className="smosp-nav-right">
            {user ? (
              <div className="smosp-topbar-right" style={{ gap: '12px' }}>

                {/* Bell notification */}
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

                {/* Avatar dropdown */}
                <div className="smosp-topbar-avatar-wrap" ref={avatarRef}>
                  <button
                    className="smosp-topbar-avatar-btn"
                    onClick={() => { setAvatarOpen((v) => !v); setBellOpen(false) }}
                    aria-label={`Tài khoản: ${user.name}`}
                    aria-expanded={avatarOpen}
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="smosp-avatar-img" />
                    ) : (
                      <span className="smosp-avatar-initials">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <IconChevron open={avatarOpen} />
                  </button>

                  {avatarOpen && (
                    <div className="smosp-avatar-dropdown" role="menu">
                      <div className="smosp-avatar-dropdown-header">
                        <div className="smosp-avatar-dropdown-avatar">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="smosp-avatar-img" />
                          ) : (
                            <span className="smosp-avatar-initials">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          )}
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
                      <button className="smosp-avatar-menu-item danger" role="menuitem" onClick={handleLogout}>
                        <IconLogout /> Đăng xuất
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <>
                <button className="smosp-nav-btn-secondary" onClick={onCtaClick}>
                  {ctaLabel}
                </button>
                <button className="smosp-nav-cta" onClick={onRegisterClick}>
                  {registerLabel}
                </button>
              </>
            )}

            {/* Hamburger */}
            <button
              className="smosp-hamburger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menuOpen}
              aria-controls="smosp-mobile-nav"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav id="smosp-mobile-nav" className="smosp-mobile-menu" aria-label="Điều hướng mobile">
            {links.map((link) => (
              <a
                key={link.href || link.label}
                href={link.href || '#'}
                onClick={(e) => { link.onClick?.(e); setMenuOpen(false) }}
                className={`smosp-mobile-link${link.active ? ' active' : ''}`}
                aria-current={link.active ? 'page' : undefined}
              >
                {link.label}
              </a>
            ))}
            {!user ? (
              <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="smosp-nav-btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { onCtaClick?.(); setMenuOpen(false) }}
                >
                  {ctaLabel}
                </button>
                <button
                  className="smosp-nav-cta"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { onRegisterClick?.(); setMenuOpen(false) }}
                >
                  {registerLabel}
                </button>
              </div>
            ) : (
              <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="smosp-nav-btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleLogout}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </nav>
        )}
      </nav>
    </>
  )
}