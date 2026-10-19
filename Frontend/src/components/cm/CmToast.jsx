import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import './cm-ui.css'

const ICONS = {
    success: CheckCircle2,
    error: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
}

/**
 * Thông báo dùng chung cho toàn bộ trang Curriculum Manager.
 *
 * Luôn nằm ở góc phải phía trên, ngay dưới thanh điều hướng (top: 100px), render
 * qua portal nên không bị các khung overflow:hidden cắt mất. Trước đây mỗi trang
 * tự dựng toast ở một vị trí khác nhau (sát mép trên, đáy màn hình, giữa dưới)
 * hoặc dùng alert() của trình duyệt.
 *
 * Trạng thái do hook useCmToast quản lý.
 */
export default function CmToast({ toasts, onDismiss }) {
    if (!toasts || toasts.length === 0) return null

    return createPortal(
        <div className="cm-toast-host" role="status" aria-live="polite">
            {toasts.map(item => {
                const Icon = ICONS[item.type] || ICONS.info
                return (
                    <div key={item.id} className={`cm-toast cm-toast--${item.type}`}>
                        <Icon className="cm-toast-icon" size={17} strokeWidth={2.3} />
                        <span className="cm-toast-text">{item.text}</span>
                        <button
                            type="button"
                            className="cm-toast-close"
                            onClick={() => onDismiss(item.id)}
                            aria-label="Đóng thông báo"
                        >
                            <X size={13} strokeWidth={2.6} />
                        </button>
                    </div>
                )
            })}
        </div>,
        document.body
    )
}
