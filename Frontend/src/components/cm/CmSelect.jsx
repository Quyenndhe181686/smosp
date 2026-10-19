import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './cm-ui.css'

/**
 * Dropdown dùng chung cho các bộ lọc CM.
 *
 * Khác biệt chính so với <select> gốc: bảng chọn được khoá đúng bằng bề rộng
 * của ô lọc (trình duyệt tự nong <select> ra theo option dài nhất, không chặn
 * được bằng CSS). Mỗi dòng vì thế cắt bằng ellipsis; rê chuột / di chuyển bằng
 * bàn phím tới dòng nào thì dòng đó mới bung đủ chữ, xuống dòng trong đúng bề
 * rộng cũ nên panel không bao giờ giãn.
 *
 * Panel render qua portal + position:fixed để không bị cắt bởi các khung
 * overflow:hidden (panel cây ngành, bảng cuộn ngang…).
 *
 * @param {{value: string, label: string}[]} options
 */
export default function CmSelect({
    value = '',
    onChange,
    options = [],
    placeholder = '-- Chọn --',
    label = null,
    disabled = false,
    searchable = null,      // mặc định: tự bật khi > 8 lựa chọn
    size = 'md',            // 'md' | 'sm'
    highlightActive = false,// tô màu thương hiệu khi đang có giá trị
    tinted = false,         // ô lọc lấy luôn màu của trạng thái đang chọn (option.tone)
    width = null,           // ví dụ '190px'; mặc định co theo khung cha
    className = '',
    id
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [cursor, setCursor] = useState(-1)
    const [rect, setRect] = useState(null)

    const wrapRef = useRef(null)
    const triggerRef = useRef(null)
    const panelRef = useRef(null)
    const searchRef = useRef(null)

    const selected = useMemo(
        () => options.find(o => String(o.value) === String(value)) || null,
        [options, value]
    )

    const useSearch = searchable ?? options.length > 8

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter(o => String(o.label).toLowerCase().includes(q))
    }, [options, query])

    /* Đo trigger để panel có toạ độ + bề rộng khớp tuyệt đối. Panel mở lên trên
       khi phía dưới không đủ chỗ. */
    const measure = useCallback(() => {
        const el = triggerRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const spaceBelow = window.innerHeight - r.bottom
        const spaceAbove = r.top
        const desired = 300
        const dropUp = spaceBelow < Math.min(desired, spaceAbove)
        setRect({
            left: r.left,
            width: r.width,
            top: dropUp ? undefined : r.bottom + 6,
            bottom: dropUp ? window.innerHeight - r.top + 6 : undefined,
            maxHeight: Math.max(160, (dropUp ? spaceAbove : spaceBelow) - 16)
        })
    }, [])

    useLayoutEffect(() => {
        if (!open) return
        measure()
    }, [open, measure])

    useEffect(() => {
        if (!open) return
        const onScrollOrResize = () => measure()
        // capture: bắt cả cuộn trong các khung con (panel cây, bảng…)
        window.addEventListener('scroll', onScrollOrResize, true)
        window.addEventListener('resize', onScrollOrResize)
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true)
            window.removeEventListener('resize', onScrollOrResize)
        }
    }, [open, measure])

    useEffect(() => {
        if (!open) return
        const onDocMouseDown = (e) => {
            if (wrapRef.current?.contains(e.target)) return
            if (panelRef.current?.contains(e.target)) return
            setOpen(false)
        }
        document.addEventListener('mousedown', onDocMouseDown)
        return () => document.removeEventListener('mousedown', onDocMouseDown)
    }, [open])

    /* Nạp lại ô tìm + con trỏ mỗi lần đóng/mở. Chỉnh ngay trong render theo đúng
       khuyến nghị của React cho "state phái sinh từ prop/state khác", tránh một
       nhịp render thừa so với việc setState trong useEffect. */
    const [syncedOpen, setSyncedOpen] = useState(open)
    if (syncedOpen !== open) {
        setSyncedOpen(open)
        setQuery('')
        setCursor(open ? options.findIndex(o => String(o.value) === String(value)) : -1)
    }

    useEffect(() => {
        if (open && useSearch) requestAnimationFrame(() => searchRef.current?.focus())
    }, [open, useSearch])

    const pick = (opt) => {
        setOpen(false)
        triggerRef.current?.focus()
        if (String(opt.value) !== String(value)) onChange?.(opt.value)
    }

    const onKeyDown = (e) => {
        if (!open) {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault()
                setOpen(true)
            }
            return
        }
        if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); return }
        if (e.key === 'Tab') { setOpen(false); return }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!visible.length) return
            const step = e.key === 'ArrowDown' ? 1 : -1
            const base = cursor >= 0 && cursor < visible.length ? cursor : (step > 0 ? -1 : 0)
            const next = (base + step + visible.length) % visible.length
            setCursor(next)
            panelRef.current?.querySelectorAll('.cmsel-opt')[next]?.scrollIntoView({ block: 'nearest' })
            return
        }
        if (e.key === 'Enter') {
            e.preventDefault()
            const opt = visible[cursor]
            if (opt) pick(opt)
        }
    }

    const isActive = highlightActive && value !== '' && value !== null && value !== undefined
    const tone = tinted ? selected?.tone : null

    return (
        <div className={`cmsel${className ? ' ' + className : ''}`} ref={wrapRef} style={width ? { width } : undefined}>
            {label && <label className="cmsel-label" htmlFor={id}>{label}</label>}

            <button
                id={id}
                ref={triggerRef}
                type="button"
                className={`cmsel-trigger${size === 'sm' ? ' cmsel-trigger--sm' : ''}${open ? ' is-open' : ''}${isActive ? ' is-active' : ''}${tone ? ' cmsel-tone-' + tone : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) setOpen(o => !o);
                }}
                onKeyDown={onKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                title={selected?.label || placeholder}
            >
                {selected?.tone && <span className={`cmsel-dot cmsel-dot--${selected.tone}`} />}
                <span className={`cmsel-value${selected ? '' : ' cmsel-value--placeholder'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown className="cmsel-caret" size={size === 'sm' ? 13 : 15} strokeWidth={2.4} />
            </button>

            {open && rect && createPortal(
                <div
                    ref={panelRef}
                    className="cmsel-panel"
                    role="listbox"
                    style={{
                        left: rect.left,
                        top: rect.top,
                        bottom: rect.bottom,
                        width: rect.width,
                        maxHeight: rect.maxHeight
                    }}
                >
                    {useSearch && (
                        <input
                            ref={searchRef}
                            className="cmsel-search"
                            value={query}
                            placeholder="Tìm..."
                            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
                            onKeyDown={onKeyDown}
                        />
                    )}

                    <div className="cmsel-list">
                        {visible.length === 0 && <div className="cmsel-empty">Không có kết quả</div>}
                        {visible.map((opt, i) => {
                            const isSel = String(opt.value) === String(value)
                            return (
                                <button
                                    key={`${opt.value}`}
                                    type="button"
                                    role="option"
                                    disabled={opt.disabled}
                                    aria-disabled={opt.disabled}
                                    aria-selected={isSel}
                                    title={opt.label}
                                    className={`cmsel-opt${isSel ? ' is-selected' : ''}${i === cursor ? ' is-cursor' : ''}${opt.disabled ? ' is-disabled' : ''}`}
                                    onMouseEnter={() => !opt.disabled && setCursor(i)}
                                    onClick={() => !opt.disabled && pick(opt)}
                                    style={opt.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                                >
                                    {opt.tone
                                        ? <span className={`cmsel-dot cmsel-dot--${opt.tone}`} />
                                        : <Check className="cmsel-opt-check" size={13} strokeWidth={3} />}
                                    <span className="cmsel-opt-text">{opt.label}</span>
                                    {opt.tone && isSel && <Check className="cmsel-opt-tick" size={13} strokeWidth={3} />}
                                </button>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
