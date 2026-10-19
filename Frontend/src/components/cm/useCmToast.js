import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION = 3200

/**
 * Quản lý hàng đợi thông báo cho các trang Curriculum Manager.
 * Dùng kèm <CmToast toasts={toasts} onDismiss={dismissToast} />.
 *
 * showToast(text, type) — type: 'success' | 'error' | 'warning' | 'info'
 */
export default function useCmToast() {
    const [toasts, setToasts] = useState([])
    const timers = useRef(new Map())
    const seq = useRef(0)

    const dismissToast = useCallback((id) => {
        setToasts(list => list.filter(t => t.id !== id))
        const timer = timers.current.get(id)
        if (timer) {
            clearTimeout(timer)
            timers.current.delete(id)
        }
    }, [])

    const showToast = useCallback((text, type = 'success', duration = DEFAULT_DURATION) => {
        if (!text) return
        const id = ++seq.current
        setToasts(list => [...list, { id, text, type }])
        timers.current.set(id, setTimeout(() => dismissToast(id), duration))
    }, [dismissToast])

    // Dọn timer khi rời trang để không setState trên component đã unmount
    useEffect(() => {
        const pending = timers.current
        return () => {
            pending.forEach(clearTimeout)
            pending.clear()
        }
    }, [])

    return { toasts, showToast, dismissToast }
}
