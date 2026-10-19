/**
 * Footer.jsx — SMOSP Design System
 *
 * Footer màu blue #034EA2 — cùng màu Navbar, KHÔNG thay đổi.
 * Logo dot màu cam #F37021.
 * Layout: logo + tagline bên trái, cột links bên phải (tối đa 3 cột), copyright dưới.
 *
 * Props:
 *   logo         string
 *   tagline      string
 *   columns      array  — [{ heading, links: [{ label, href, onClick }] }]
 *   copyright    string
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import logoSvg from '../../asset/logo.svg'

const FOOTER_CSS = `
  .smosp-footer-link {
    color: rgba(255, 255, 255, 0.60);
    font-size: 14px;
    font-family: 'Be Vietnam Pro', sans-serif;
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
    transition: color 150ms ease;
    line-height: 1;
  }
  .smosp-footer-link:hover {
    color: #ffffff;
  }
`

export default function Footer({
  logo = 'SMOSP',
  tagline = 'Hệ thống định hướng chuyên ngành hẹp cho sinh viên Đại học FPT.',
  columns = null,
  copyright = `© ${new Date().getFullYear()} SMOSP · Đồ án tốt nghiệp FPTU`,
}) {
  const navigate = useNavigate()

  // Chỉ giữ liên kết trỏ tới đích CÓ THẬT trên frontend. 7 link hash cũ
  // (#holland-test, #recommendations, #transfer-rules, #guide, #faq, #contact,
  // #terms, #privacy) không có anchor nào tồn tại nên đều dẫn tới trang trắng;
  // Holland/Chuyển ngành còn là tính năng đã Deferred (DEF_36, nối tiếp DEF_01).
  const defaultColumns = [
    {
      heading: 'Tính Năng',
      links: [
        { label: 'Gợi ý chuyên ngành hẹp', href: '/#specialization-recommendations' },
        { label: 'Lộ trình học tập', href: '/#roadmap' },
        { label: 'Mục lục ngành học', href: '/major-catalog' },
      ],
    },
    {
      heading: 'Tài Khoản',
      links: [
        { label: 'Đăng nhập', href: '/login' },
        { label: 'Đăng ký', href: '/register' },
        { label: 'Quên mật khẩu', href: '/forgot-password' },
      ],
    },
    {
      heading: 'Về Dự Án',
      links: [
        { label: 'Đại học FPT', href: 'https://fpt.edu.vn' },
      ],
    },
  ]

  const displayColumns = columns || defaultColumns

  const handleLinkClick = (e, link) => {
    if (link.onClick) {
      link.onClick(e)
      return
    }
    if (link.href) {
      if (link.href.startsWith('http')) {
        // External link, let it navigate normally
        return
      }
      e.preventDefault()
      if (link.href.includes('#')) {
        const [path, hash] = link.href.split('#')
        navigate(path)
        setTimeout(() => {
          document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else {
        navigate(link.href)
      }
    }
  }

  return (
    <>
      <style>{FOOTER_CSS}</style>
      <footer
        style={{
          background: '#034EA2',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '48px 0 32px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 48px',
          }}
        >
          {/* Top: logo + columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: displayColumns.length > 0
                ? `280px repeat(${displayColumns.length}, 1fr)`
                : '280px',
              gap: '32px',
              marginBottom: '32px',
            }}
          >
            {/* Logo + tagline */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-0.02em',
                  marginBottom: '12px',
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                }}
              >
                <img src={logoSvg} alt="SMOSP Logo" style={{ height: '32px', width: 'auto', display: 'block' }} />
                <span>SMOSP</span>
              </div>
              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.60)',
                  fontSize: '14px',
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  lineHeight: 1.6,
                  maxWidth: '220px',
                }}
              >
                {tagline}
              </p>
            </div>

            {/* Link columns */}
            {displayColumns.map((col) => (
              <div key={col.heading}>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '12px',
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginBottom: '16px',
                  }}
                >
                  {col.heading}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href || '#'}
                      onClick={(e) => handleLinkClick(e, link)}
                      className="smosp-footer-link"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              marginBottom: '16px',
            }}
          />

          {/* Copyright */}
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.35)',
              fontSize: '11px',
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {copyright}
          </div>
        </div>
      </footer>
    </>
  )
}

/* ── Usage Examples ─────────────────────────────────────────
 *
 * import Footer from '@/shared/components/Footer'
 *
 * const FOOTER_COLUMNS = [
 *   {
 *     heading: 'Tính Năng',
 *     links: [
 *       { label: 'Đánh Giá Holland', href: '/assessment' },
 *       { label: 'Lộ Trình Kỹ Năng', href: '/roadmap' },
 *       { label: 'Phân Tích Kỹ Năng', href: '/skill-gap' },
 *       { label: 'So Sánh Ngành', href: '/compare' },
 *     ],
 *   },
 *   {
 *     heading: 'Hỗ Trợ',
 *     links: [
 *       { label: 'Hướng Dẫn Sử Dụng', href: '/guide' },
 *       { label: 'Câu Hỏi Thường Gặp', href: '/faq' },
 *       { label: 'Liên Hệ', href: '/contact' },
 *     ],
 *   },
 *   {
 *     heading: 'Về Dự Án',
 *     links: [
 *       { label: 'Nhóm Phát Triển', href: '/team' },
 *       { label: 'Điều Khoản', href: '/terms' },
 *       { label: 'Bảo Mật', href: '/privacy' },
 *     ],
 *   },
 * ]
 *
 * <Footer
 *   logo="OrientFPT"
 *   tagline="Định hướng thông minh, bứt phá sự nghiệp trong kỷ nguyên số."
 *   columns={FOOTER_COLUMNS}
 * />
 */