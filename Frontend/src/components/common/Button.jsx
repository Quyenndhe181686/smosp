/**
 * Button.jsx — SMOSP Design System
 *
 * Palette: Orange #F37021 · Blue #034EA2 · Green #51B848
 *
 * Variants:
 *   primary      — Cam #F37021, dùng cho action chính
 *   accent       — Xanh lá #51B848, dùng cho CTA phụ
 *   secondary    — Nền blue nhạt, chữ blue (ghost-fill)
 *   ghost        — Outline cam, nền transparent
 *   ghost-blue   — Outline blue, nền transparent
 *   danger       — Đỏ #C0392B, dùng cho delete/destructive action
 *
 * Sizes:
 *   sm  — height 34px, font 13px
 *   md  — height 44px, font 14px  ← mặc định
 *   lg  — height 52px, font 16px
 *
 * Props:
 *   variant      string
 *   size         'sm' | 'md' | 'lg'
 *   fullWidth    boolean — width 100%
 *   loading      boolean — hiển thị spinner, disable button
 *   disabled     boolean
 *   leftIcon     ReactNode — icon Lucide bên trái
 *   rightIcon    ReactNode — icon Lucide bên phải
 *   as           'button' | 'a' — render as <a> khi cần link
 *   href         string — chỉ dùng khi as='a'
 *   onClick      function
 *   type         'button' | 'submit' | 'reset'
 *   children     ReactNode
 */

import React from 'react'

/* ── CSS ─────────────────────────────────────────────────── */

const BUTTON_CSS = `
  .smosp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    font-family: 'Be Vietnam Pro', sans-serif;
    font-weight: 600;
    border-radius: 10px;
    transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
    white-space: nowrap;
    line-height: 1;
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
    outline: none;
  }
  .smosp-btn:focus-visible {
    box-shadow: 0 0 0 3px rgba(243, 112, 33, 0.4);
  }

  /* ── Sizes ── */
  .smosp-btn--sm  { height: 34px; padding: 0 14px; font-size: 13px; }
  .smosp-btn--md  { height: 44px; padding: 0 24px; font-size: 14px; }
  .smosp-btn--lg  { height: 52px; padding: 0 32px; font-size: 16px; font-weight: 700; }

  /* ── full width ── */
  .smosp-btn--full { width: 100%; }

  /* ── Variants ── */
  .smosp-btn--primary   { background: #F37021; color: #ffffff; }
  .smosp-btn--primary:hover:not(:disabled) { background: #D4580A; transform: translateY(-1px); }
  .smosp-btn--primary:active:not(:disabled) { transform: translateY(0); }

  .smosp-btn--accent    { background: #51B848; color: #ffffff; }
  .smosp-btn--accent:hover:not(:disabled)  { background: #3A9132; transform: translateY(-1px); }
  .smosp-btn--accent:active:not(:disabled) { transform: translateY(0); }

  .smosp-btn--secondary { background: #E6EEF9; color: #034EA2; border: none; }
  .smosp-btn--secondary:hover:not(:disabled)  { background: #ccdaf5; transform: translateY(-1px); }
  .smosp-btn--secondary:active:not(:disabled) { transform: translateY(0); }

  .smosp-btn--ghost     { background: transparent; color: #F37021; border: 1.5px solid #F37021; }
  .smosp-btn--ghost:hover:not(:disabled)  { background: #FFF0E6; }

  .smosp-btn--ghost-blue { background: transparent; color: #034EA2; border: 1.5px solid #034EA2; }
  .smosp-btn--ghost-blue:hover:not(:disabled) { background: #E6EEF9; }

  .smosp-btn--danger    { background: #C0392B; color: #ffffff; }
  .smosp-btn--danger:hover:not(:disabled) { background: #a93226; transform: translateY(-1px); }
  .smosp-btn--danger:active:not(:disabled){ transform: translateY(0); }

  /* ── States ── */
  .smosp-btn:disabled, .smosp-btn--loading {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
    transform: none !important;
  }

  /* ── Spinner ── */
  @keyframes smosp-spin { to { transform: rotate(360deg); } }
  .smosp-btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: smosp-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .smosp-btn--ghost .smosp-btn-spinner,
  .smosp-btn--ghost-blue .smosp-btn-spinner,
  .smosp-btn--secondary .smosp-btn-spinner {
    border-color: rgba(0,0,0,0.15);
    border-top-color: currentColor;
  }
`

/* ── Component ───────────────────────────────────────────── */

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  as: Tag = 'button',
  href,
  onClick,
  type = 'button',
  className = '',
  children,
  style: extraStyle = {},
  ...rest
}) {
  const btnClass = [
    'smosp-btn',
    `smosp-btn--${size}`,
    `smosp-btn--${variant}`,
    fullWidth  ? 'smosp-btn--full'    : '',
    loading    ? 'smosp-btn--loading' : '',
    className,
  ].filter(Boolean).join(' ')

  const props = {
    className: btnClass,
    style: extraStyle,
    onClick,
    disabled: disabled || loading,
    ...(Tag === 'button' ? { type } : {}),
    ...(Tag === 'a'      ? { href } : {}),
    ...rest,
  }

  return (
    <>
      <style>{BUTTON_CSS}</style>
      <Tag {...props}>
        {loading && <span className="smosp-btn-spinner" aria-hidden="true" />}
        {!loading && leftIcon && (
          <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {leftIcon}
          </span>
        )}
        {children}
        {!loading && rightIcon && (
          <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {rightIcon}
          </span>
        )}
      </Tag>
    </>
  )
}

/* ── Usage Examples ─────────────────────────────────────────
 *
 * import Button from '@/components/layout/common/Button'
 * import { Map, Brain, X, Star } from 'lucide-react'
 *
 * // Variants
 * <Button variant="primary">Xem Lộ Trình Kỹ Năng</Button>
 * <Button variant="accent" leftIcon={<Brain size={16} />}>Bắt Đầu Đánh Giá Holland</Button>
 * <Button variant="secondary">Secondary — Navy nhạt</Button>
 * <Button variant="ghost" leftIcon={<X size={16} />}>Hủy</Button>
 * <Button variant="ghost-blue" leftIcon={<Star size={14} />}>Lưu</Button>
 * <Button variant="danger">Xóa tài khoản</Button>
 *
 * // Sizes
 * <Button size="sm" variant="primary">Nhỏ</Button>
 * <Button size="md" variant="primary">Vừa (mặc định)</Button>
 * <Button size="lg" variant="primary">Lớn</Button>
 *
 * // Full width (dùng trong form)
 * <Button fullWidth variant="primary" type="submit">Đăng nhập hệ thống</Button>
 *
 * // Loading state
 * <Button loading variant="primary">Đang xử lý...</Button>
 *
 * // Disabled
 * <Button disabled variant="primary">Không khả dụng</Button>
 *
 * // Render as <a> (link)
 * <Button as="a" href="/roadmap" variant="ghost-blue">Xem Demo</Button>
 *
 * // Trong form submit
 * <Button type="submit" fullWidth loading={isLoading} variant="primary">
 *   Đăng nhập hệ thống
 * </Button>
 */