/**
 * Input.jsx — SMOSP Design System
 *
 * Palette: Orange #F37021 · Blue #034EA2 · Error #C0392B
 *
 * Props:
 *   label        string
 *   helper       string
 *   error        string
 *   id           string
 *   type         string — 'text' | 'email' | 'password' | 'number' | 'search'
 *   as           'input' | 'textarea' | 'select'
 *   rows         number — chỉ dùng khi as='textarea', default 4
 *   disabled     boolean
 *   required     boolean
 *   leftIcon     ReactNode — icon Lucide bên trái
 *   rightIcon    ReactNode
 *   children     ReactNode — cho <select>: các <option>
 */

import React, { useId } from 'react'
import { AlertCircle } from 'lucide-react'

/* ── CSS ─────────────────────────────────────────────────── */

const INPUT_CSS = `
  .smosp-field-input {
    height: 44px;
    padding: 0 14px;
    border: 1.5px solid #D4DCF0;
    border-radius: 10px;
    font-family: 'Be Vietnam Pro', sans-serif;
    font-size: 15px;
    color: #0D1A3A;
    background: #FFFFFF;
    outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    box-sizing: border-box;
  }
  .smosp-field-input::placeholder {
    color: #8A96B8;
  }
  .smosp-field-input:hover:not(:disabled):not(.smosp-field-input--error) {
    border-color: #8A96B8;
  }
  .smosp-field-input:focus:not(.smosp-field-input--error) {
    border-color: #F37021;
    box-shadow: 0 0 0 4px rgba(243, 112, 33, 0.12);
  }
  .smosp-field-input--error {
    border-color: #C0392B !important;
  }
  .smosp-field-input--error:focus {
    box-shadow: 0 0 0 4px rgba(192, 57, 43, 0.08);
  }
  .smosp-field-input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: #EEF2F8;
  }
  .smosp-field-input--left  { padding-left: 40px !important; }
  .smosp-field-input--right { padding-right: 40px !important; }
  .smosp-field-textarea {
    height: auto !important;
    padding: 12px 14px !important;
    resize: vertical;
    line-height: 1.6;
  }
  .smosp-field-select {
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234A5678' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px !important;
  }
`

/* ── Base style object ───────────────────────────────────── */

const BASE_STYLE = {
  boxSizing: 'border-box',
}

/* ── Component ───────────────────────────────────────────── */

export default function Input({
  label,
  helper,
  error,
  id: propId,
  type = 'text',
  as = 'input',
  rows = 4,
  disabled = false,
  required = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  children,
  ...rest
}) {
  const autoId = useId()
  const inputId = propId || autoId
  const hasError = Boolean(error)

  const inputClass = [
    'smosp-field-input',
    hasError             ? 'smosp-field-input--error'  : '',
    leftIcon             ? 'smosp-field-input--left'   : '',
    (rightIcon || (as === 'select')) ? 'smosp-field-input--right' : '',
    as === 'textarea'    ? 'smosp-field-textarea'       : '',
    as === 'select'      ? 'smosp-field-select'         : '',
    className,
  ].filter(Boolean).join(' ')

  const fieldProps = {
    id: inputId,
    disabled,
    required,
    'aria-invalid': hasError || undefined,
    'aria-describedby': error
      ? `${inputId}-error`
      : helper
      ? `${inputId}-helper`
      : undefined,
    className: inputClass,
    style: BASE_STYLE,
    ...rest,
  }

  const renderField = () => {
    if (as === 'textarea') {
      return <textarea rows={rows} {...fieldProps} />
    }
    if (as === 'select') {
      return <select {...fieldProps}>{children}</select>
    }
    return <input type={type} {...fieldProps} />
  }

  return (
    <>
      <style>{INPUT_CSS}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>

        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#0D1A3A',
              lineHeight: 1.4,
              fontFamily: "'Be Vietnam Pro', sans-serif",
              cursor: disabled ? 'not-allowed' : 'default',
            }}
          >
            {label}
            {required && (
              <span style={{ color: '#F37021', marginLeft: '3px' }} aria-hidden="true">*</span>
            )}
          </label>
        )}

        {/* Input wrapper */}
        <div style={{ position: 'relative', width: '100%' }}>

          {/* Left icon */}
          {leftIcon && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#8A96B8',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}

          {renderField()}

          {/* Right icon / error icon */}
          {(hasError || rightIcon) && as !== 'select' && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: hasError ? '#C0392B' : '#8A96B8',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {hasError ? <AlertCircle size={16} /> : rightIcon}
            </span>
          )}
        </div>

        {/* Error */}
        {hasError && (
          <p
            id={`${inputId}-error`}
            role="alert"
            style={{
              fontSize: '12px',
              color: '#C0392B',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            {error}
          </p>
        )}

        {/* Helper */}
        {helper && !hasError && (
          <p
            id={`${inputId}-helper`}
            style={{
              fontSize: '12px',
              color: '#4A5678',
              lineHeight: 1.4,
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            {helper}
          </p>
        )}
      </div>
    </>
  )
}

/* ── Usage Examples ─────────────────────────────────────────
 *
 * import Input from '@/shared/components/Input'
 * import { Mail, Lock } from 'lucide-react'
 *
 * <Input id="name" label="Họ và tên" placeholder="Nguyễn Văn A" required />
 *
 * <Input id="email" type="email" label="Email"
 *   leftIcon={<Mail size={16} />}
 *   helper="Dùng email @fpt.edu.vn hoặc @fe.edu.vn" />
 *
 * <Input id="pass" type="password" label="Mật khẩu"
 *   leftIcon={<Lock size={16} />}
 *   error="Mật khẩu phải có ít nhất 8 ký tự" />
 *
 * <Input as="textarea" id="bio" label="Giới thiệu bản thân" rows={3}
 *   placeholder="Mô tả ngắn về bạn và mục tiêu nghề nghiệp..." />
 *
 * <Input as="select" id="major" label="Ngành quan tâm">
 *   <option value="">Chọn ngành...</option>
 *   <option value="ai">Trí tuệ nhân tạo</option>
 *   <option value="se">Kỹ thuật phần mềm</option>
 * </Input>
 *
 * <Input id="uid" label="Mã sinh viên" value="SE170001" disabled
 *   helper="Không thể chỉnh sửa" />
 */
