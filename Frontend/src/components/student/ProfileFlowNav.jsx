import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react'
import { useProfileFlow } from './profileFlow'
import './ProfileFlowNav.css'

/**
 * Thanh tiến trình khai báo hồ sơ — dùng chung cho cả 4 trang.
 * Cho thấy rõ thứ tự: Thông tin cá nhân ➔ Bảng điểm ➔ Kỹ năng ➔ Sở thích.
 */
export function ProfileFlowStepper({ current }) {
    return <ProfileFlowFooter current={current} />
}

/** Thanh 5 ô chuyển hướng luồng hồ sơ (Thông tin cá nhân ➔ Bảng điểm ➔ Kỹ năng ➔ Sở thích ➔ Gợi ý chuyên ngành). */
export function ProfileFlowFooter({ current }) {
    const { steps, completion } = useProfileFlow(current)
    const navigate = useNavigate()

    const canRecommend = Boolean(completion?.transcript)
    const isRecCurrent = current === 'recommendation'

    return (
        <div className="pf-top-nav">
            <div className="pf-boxes-grid">
                {steps.map((step) => {
                    const isDone = step.done
                    const isCurrent = step.current

                    return (
                        <button
                            type="button"
                            key={step.key}
                            className={[
                                'pf-nav-box',
                                `pf-nav-box--${step.accent}`,
                                isDone ? 'pf-nav-box--done' : '',
                                isCurrent ? 'pf-nav-box--current' : ''
                            ].filter(Boolean).join(' ')}
                            onClick={() => navigate(step.path)}
                        >
                            <div className="pf-box-badge">
                                {isDone ? (
                                    <Check size={16} strokeWidth={3.2} />
                                ) : (
                                    <span>{step.order}</span>
                                )}
                            </div>
                            <div className="pf-box-text">
                                <span className="pf-box-label">{step.label}</span>
                                <span className="pf-box-state">
                                    {isDone ? 'Đã khai báo' : isCurrent ? 'Đang khai báo' : 'Chưa khai báo'}
                                </span>
                            </div>
                        </button>
                    )
                })}

                {/* Ô thứ 5: Gợi ý chuyên ngành (cùng hàng với 4 ô trên) */}
                <button
                    type="button"
                    className={[
                        'pf-nav-box',
                        'pf-nav-box--recommend',
                        canRecommend ? 'pf-nav-box--rec-active' : 'pf-nav-box--rec-disabled',
                        isRecCurrent ? 'pf-nav-box--current' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                        if (canRecommend) {
                            navigate('/student/recommendation')
                        }
                    }}
                    disabled={!canRecommend}
                    title={canRecommend ? 'Nhận gợi ý chuyên ngành hẹp phù hợp' : 'Cần tải bảng điểm để kích hoạt tính năng gợi ý'}
                    aria-disabled={!canRecommend}
                >
                    <div className="pf-box-badge pf-rec-badge">
                        <Sparkles size={16} strokeWidth={canRecommend ? 2.6 : 2} />
                    </div>
                    <div className="pf-box-text">
                        <span className="pf-box-label">Gợi ý chuyên ngành hẹp</span>
                        <span className="pf-box-state">
                            {canRecommend ? 'Đã đủ dữ liệu' : 'Chưa đủ dữ liệu'}
                        </span>
                    </div>
                    <div className="pf-rec-arrow-wrap">
                        <ArrowRight size={15} strokeWidth={2.8} />
                    </div>
                </button>
            </div>
        </div>
    )
}

/**
 * Cảnh báo thiếu dữ liệu của một bước trước đó, kèm nút nhảy thẳng tới bước đó và nút đóng (x).
 */
export function ProfileFlowAlert({ stepKey, title, message, ctaLabel = 'Khai báo ngay', dismissible = true, onDismiss }) {
    const navigate = useNavigate()
    const { steps } = useProfileFlow(null)
    const [closed, setClosed] = useState(false)
    const step = steps.find((s) => s.key === stepKey)
    if (!step || closed) return null

    const handleClose = () => {
        setClosed(true)
        if (onDismiss) onDismiss()
    }

    return (
        <div className={`pf-alert pf-alert--${step.accent}`} role="status">
            <span className="pf-alert-icon"><AlertTriangle size={19} /></span>
            <div className="pf-alert-body">
                <strong className="pf-alert-title">{title}</strong>
                <span className="pf-alert-text">{message}</span>
            </div>
            <div className="pf-alert-actions">
                <button type="button" className="pf-alert-btn" onClick={() => navigate(step.path)}>
                    {ctaLabel}
                </button>
                {dismissible && (
                    <button type="button" className="pf-alert-close-btn" onClick={handleClose} aria-label="Đóng thông báo" title="Đóng thông báo">
                        &times;
                    </button>
                )}
            </div>
        </div>
    )
}

/**
 * Thông báo nổi ở góc phải bên trên màn hình (fixed top: 100px; right: 24px)
 * Dùng chung cho cả 4 trang khi người dùng thực hiện thao tác (lưu thành công, thất bại, ...)
 */
export function ProfileFlowToast({ toast, onClose }) {
    if (!toast || !toast.message) return null

    return (
        <div className={`pf-toast pf-toast--${toast.type || 'success'}`} role="alert">
            <span className="pf-toast-icon">
                {toast.type === 'error' ? (
                    <AlertTriangle size={18} strokeWidth={2.5} />
                ) : (
                    <Check size={18} strokeWidth={3} />
                )}
            </span>
            <span className="pf-toast-msg">{toast.message}</span>
            {onClose && (
                <button type="button" className="pf-toast-close" onClick={onClose} aria-label="Đóng">
                    &times;
                </button>
            )}
        </div>
    )
}

/**
 * Thông báo 1 dòng chữ đỏ nhỏ gọn khi chưa khai báo thông tin cá nhân.
 * Chữ "thông tin cá nhân" có màu xanh dương và gạch chân, click vào chuyển hướng sang trang Thông tin cá nhân.
 */
export function ProfileIncompleteNotice({ className = '', style = {} }) {
    return (
        <span className={`pf-incomplete-notice ${className}`} style={style}>
            Bạn chưa khai báo{' '}
            <Link to="/student/profile" className="pf-incomplete-link">
                thông tin cá nhân
            </Link>
            .
        </span>
    )
}


