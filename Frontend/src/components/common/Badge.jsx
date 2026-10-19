/**
 * Badge.jsx — SMOSP Design System
 *
 * Palette: Orange #F37021 · Blue #034EA2 · Green #51B848
 *
 * Variants:
 *   skill      — Tag kỹ năng, nền blue nhạt (badge-blue)
 *   high       — Match cao 80–100%, nền success xanh lá
 *   medium     — Match vừa 50–79%, nền warning vàng
 *   low        — Match thấp < 50%, nền error đỏ
 *   orange     — Gợi ý / nổi bật, nền cam nhạt (badge-orange)
 *   green      — Hoàn thành / achievement, nền xanh lá nhạt
 *   navy       — Đồ án / neutral, nền navy nhạt
 *   neutral    — Trạng thái xám / inactive
 *
 * Shape:
 *   tag        — Bo góc nhỏ 6px (mặc định)
 *   pill       — Bo tròn 9999px
 *
 * Props:
 *   variant    string
 *   shape      'tag' | 'pill'
 *   size       'sm' | 'md'
 *   dot        boolean — chấm tròn bên trái (badge-dot)
 *   icon       ReactNode — icon Lucide
 *   children   ReactNode
 */

import React from 'react'

/* ── Style maps ─────────────────────────────────────────── */

const VARIANT_STYLES = {
  skill: {
    background: '#E6EEF9',          // --secondary-light
    color: '#023880',               // --secondary-dark
  },
  high: {
    background: '#E2F5EE',          // --success-light
    color: '#2D7A5A',               // --success
  },
  medium: {
    background: '#FDF5DC',          // --warning-light
    color: '#B07800',
  },
  low: {
    background: '#FDECEA',          // --error-light
    color: '#C0392B',               // --error
  },
  orange: {
    background: '#FFF0E6',          // --primary-light
    color: '#D4580A',               // --primary-hover
  },
  green: {
    background: '#EBF8EA',          // --accent-light
    color: '#3A9132',               // --accent-dark
  },
  navy: {
    background: '#E0E4F4',
    color: '#162670',               // --navy
  },
  neutral: {
    background: '#EEF2F8',          // --surface-alt
    color: '#4A5678',               // --text-secondary
  },
}

const SIZE_STYLES = {
  sm: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    gap: '4px',
    minHeight: '20px',
  },
  md: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 10px',
    gap: '4px',
    minHeight: '24px',
  },
}

/* ── Component ───────────────────────────────────────────── */

export default function Badge({
  variant = 'skill',
  shape = 'tag',
  size = 'md',
  dot = false,
  icon = null,
  children,
  className = '',
  style: extraStyle = {},
  ...rest
}) {
  const borderRadius = shape === 'pill' ? '9999px' : '6px'

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    verticalAlign: 'middle',
    fontFamily: "'Be Vietnam Pro', sans-serif",
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    ...extraStyle,
  }

  const dotColor = VARIANT_STYLES[variant]?.color

  return (
    <span className={className} style={badgeStyle} {...rest}>
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {icon && (
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}

/* ── Usage Examples ──────────────────────────────────────────
 *
 * import Badge from '@/shared/components/Badge'
 *
 * // Skill tags
 * <Badge variant="skill">React.js</Badge>
 * <Badge variant="skill">Machine Learning</Badge>
 *
 * // Match percentage — pill
 * <Badge variant="orange" shape="pill" dot>Phù hợp nhất</Badge>
 * <Badge variant="high" shape="pill">87% phù hợp</Badge>
 * <Badge variant="medium" shape="pill">63% phù hợp</Badge>
 * <Badge variant="low" shape="pill">34% phù hợp</Badge>
 *
 * // Status
 * <Badge variant="green" dot>Đang tuyển dụng</Badge>
 * <Badge variant="orange">Gợi ý hệ thống</Badge>
 * <Badge variant="navy">Đồ án tốt nghiệp</Badge>
 *
 * // Size nhỏ
 * <Badge variant="neutral" size="sm">Chưa mở</Badge>
 */