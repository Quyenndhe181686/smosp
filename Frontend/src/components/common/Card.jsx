/**
 * Card.jsx — SMOSP Design System
 *
 * Palette: Orange #F37021 · Blue #034EA2 · Green #51B848
 *
 * Variants:
 *   default   — Card trắng tiêu chuẩn, hover lift + border blue
 *   featured  — Viền cam 3px phía trên (card-featured)
 *   blue      — Viền blue 3px phía trên (card-blue)
 *   green     — Viền green 3px phía trên (card-green)
 *   inset     — Nền surface-alt, không hover, dùng bên trong card
 *   flat      — Không border, không hover
 *
 * Props:
 *   variant    'default' | 'featured' | 'blue' | 'green' | 'inset' | 'flat'
 *   as         'div' | 'article' | 'section' | 'li'
 *   onClick    function
 *   padding    'sm' | 'md' | 'lg'
 *   className  string
 *   children   ReactNode
 *
 * Sub-components:
 *   Card.Header  — phần trên (title + badge)
 *   Card.Body    — nội dung chính
 *   Card.Footer  — action area
 *   Card.Inset   — khối stat/data bên trong card (card-inset)
 *   Card.Stat    — số liệu lớn (card-stat)
 *   Card.Divider — đường kẻ ngang
 */

import React from 'react'

/* ── Style maps ─────────────────────────────────────────── */

const VARIANT_BASE = {
  background: '#FFFFFF',
  border: '1px solid #D4DCF0',
  borderRadius: '20px',
  boxShadow: 'none',
}

const VARIANT_STYLES = {
  default: {
    ...VARIANT_BASE,
  },
  featured: {
    ...VARIANT_BASE,
    borderTop: '3px solid #F37021',
  },
  blue: {
    ...VARIANT_BASE,
    borderTop: '3px solid #034EA2',
  },
  green: {
    ...VARIANT_BASE,
    borderTop: '3px solid #51B848',
  },
  inset: {
    background: '#EEF2F8',
    border: '1px solid #D4DCF0',
    borderRadius: '10px',
    boxShadow: 'none',
  },
  flat: {
    background: 'transparent',
    border: 'none',
    borderRadius: '20px',
    boxShadow: 'none',
  },
}

const PADDING_MAP = {
  sm: '16px 20px',
  md: '28px',
  lg: '36px 40px',
}

/* ── CSS hover (default, featured, blue, green) ───────────── */
const CARD_CSS = `
  .smosp-card--hoverable {
    transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
    cursor: pointer;
  }
  .smosp-card--hoverable:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(3, 78, 162, 0.12);
    border-color: #034EA2 !important;
  }
  .smosp-card--hoverable:active {
    transform: translateY(-1px);
  }
`

/* ── Main Card component ─────────────────────────────────── */

function Card({
  variant = 'default',
  as: Tag = 'div',
  onClick,
  padding = 'md',
  className = '',
  children,
  style: extraStyle = {},
  ...rest
}) {
  const isHoverable = ['default', 'featured', 'blue', 'green'].includes(variant)
  const isClickable = Boolean(onClick)

  const cardClass = [
    isHoverable ? 'smosp-card--hoverable' : '',
    className,
  ].filter(Boolean).join(' ')

  const cardStyle = {
    ...VARIANT_STYLES[variant],
    padding: PADDING_MAP[padding],
    ...extraStyle,
  }

  return (
    <>
      <style>{CARD_CSS}</style>
      <Tag
        className={cardClass}
        style={cardStyle}
        onClick={onClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e)
            : undefined
        }
        {...rest}
      >
        {children}
      </Tag>
    </>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

Card.Header = function CardHeader({ children, style = {} }) {
  return (
    <div style={{ marginBottom: '14px', ...style }}>
      {children}
    </div>
  )
}

Card.Body = function CardBody({ children, style = {} }) {
  return (
    <div style={{ color: '#4A5678', fontSize: '15px', lineHeight: 1.6, ...style }}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({ children, style = {} }) {
  return (
    <div
      style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid #D4DCF0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// card-inset trong HTML: background surface-alt, border, radius-sm, padding 16px
Card.Inset = function CardInset({ children, style = {} }) {
  return (
    <div
      style={{
        background: '#EEF2F8',
        border: '1px solid #D4DCF0',
        borderRadius: '6px',
        padding: '16px',
        marginTop: '14px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// card-stat: số liệu lớn — JetBrains Mono, màu theo variant (orange/blue/green)
Card.Stat = function CardStat({ value, label, color = 'orange', style = {} }) {
  const colorMap = {
    orange: '#F37021',   // --primary
    blue:   '#034EA2',   // --secondary
    green:  '#3A9132',   // --accent-dark
  }
  return (
    <div style={style}>
      <div style={{
        fontSize: '36px',
        fontWeight: 800,
        lineHeight: 1,
        fontFamily: "'JetBrains Mono', monospace",
        color: colorMap[color] || colorMap.orange,
      }}>
        {value}
      </div>
      {label && (
        <div style={{
          fontSize: '12px',
          color: '#8A96B8',
          marginTop: '4px',
        }}>
          {label}
        </div>
      )}
    </div>
  )
}

Card.Divider = function CardDivider({ style = {} }) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid #D4DCF0',
        margin: '16px 0',
        ...style,
      }}
    />
  )
}

// Skills tag row bên trong card
Card.Skills = function CardSkills({ children, style = {} }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginTop: '10px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// Salary label (card-salary)
Card.Salary = function CardSalary({ children, style = {} }) {
  return (
    <div
      style={{
        fontSize: '13px',
        color: '#4A5678',
        padding: '6px 10px',
        background: '#EBF8EA',
        borderRadius: '6px',
        display: 'inline-block',
        marginTop: '8px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default Card

/* ── Usage Examples ─────────────────────────────────────────
 *
 * import Card from '@/shared/components/Card'
 * import Badge from '@/shared/components/Badge'
 *
 * // Card recommendation chuẩn
 * <Card variant="featured">
 *   <Card.Header>
 *     <Badge variant="orange" shape="pill" dot>Phù hợp nhất</Badge>
 *     <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>Trí Tuệ Nhân Tạo</h3>
 *     <Card.Salary>Lương TB: <strong>18–28M VND/tháng</strong> · VietnamWorks Q1 2026</Card.Salary>
 *   </Card.Header>
 *   <Card.Body>3 kỹ năng phân biệt hồ sơ của bạn với yêu cầu Junior AI Engineer.</Card.Body>
 *   <Card.Skills>
 *     <Badge variant="skill">Python</Badge>
 *     <Badge variant="skill">Machine Learning</Badge>
 *   </Card.Skills>
 *   <Card.Inset>
 *     <Card.Stat value="87%" label="Độ phù hợp với hồ sơ hiện tại" color="orange" />
 *   </Card.Inset>
 *   <Card.Footer>
 *     <button className="btn btn-md btn-primary">Xem Lộ Trình</button>
 *     <button className="btn btn-md btn-ghost-blue">Tìm Hiểu Thêm</button>
 *   </Card.Footer>
 * </Card>
 *
 * // Card có thể bấm
 * <Card onClick={() => navigate('/major/ai')}>
 *   <h3>Trí tuệ nhân tạo</h3>
 * </Card>
 */