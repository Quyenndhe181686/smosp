import { SlidersHorizontal } from 'lucide-react'
import CmSelect from './CmSelect'
import './cm-ui.css'

/**
 * Thanh lọc Ngành → Chuyên ngành → Chuyên ngành hẹp dùng chung cho các trang CM.
 *
 * Dùng CmSelect thay <select> gốc để bảng chọn luôn rộng đúng bằng ô lọc; tên
 * ngành dài bị cắt bằng ellipsis và chỉ bung đủ chữ khi rê chuột vào — nhờ vậy
 * không còn phải cắt cứng chuỗi ở tầng dữ liệu.
 */
export default function CmCatalogFilter({
    majors = [],
    selectedMajorId = '',
    onMajorChange,

    specs = [],
    selectedSpecId = '',
    onSpecChange,

    narrowSpecs = [],
    selectedNsId = '',
    onNsChange,

    statusOptions = null, // ví dụ [{ value: '', label: 'Tất cả' }, ...]
    selectedStatus = '',
    onStatusChange,

    extraControls = null
}) {
    const toOptions = (list, emptyLabel) => [
        { value: '', label: emptyLabel },
        ...list.map(item => ({ value: String(item.id), label: item.name }))
    ]

    return (
        <div className="cmf-bar">
            <span className="cmf-lead">
                <SlidersHorizontal size={14} strokeWidth={2.4} />
                Bộ lọc
            </span>

            <div className="cmf-fields">
                {onMajorChange && (
                    <CmSelect
                        label="Ngành"
                        placeholder="Tất cả ngành"
                        options={toOptions(majors, 'Tất cả ngành')}
                        value={String(selectedMajorId ?? '')}
                        onChange={onMajorChange}
                        highlightActive
                        className="cmf-field"
                    />
                )}

                {onSpecChange && (
                    <CmSelect
                        label="Chuyên ngành"
                        placeholder="Tất cả chuyên ngành"
                        options={toOptions(specs, 'Tất cả chuyên ngành')}
                        value={String(selectedSpecId ?? '')}
                        onChange={onSpecChange}
                        disabled={!specs.length}
                        highlightActive
                        className="cmf-field"
                    />
                )}

                {onNsChange && (
                    <CmSelect
                        label="Chuyên ngành hẹp"
                        placeholder="Tất cả chuyên ngành hẹp"
                        options={toOptions(narrowSpecs, 'Tất cả chuyên ngành hẹp')}
                        value={String(selectedNsId ?? '')}
                        onChange={onNsChange}
                        disabled={!narrowSpecs.length}
                        highlightActive
                        className="cmf-field"
                    />
                )}

                {statusOptions && onStatusChange && (
                    <CmSelect
                        label="Trạng thái"
                        placeholder="Tất cả"
                        options={statusOptions.map(o => ({ value: String(o.value), label: o.label }))}
                        value={String(selectedStatus ?? '')}
                        onChange={onStatusChange}
                        highlightActive
                        className="cmf-field cmf-field--narrow"
                    />
                )}
            </div>

            {extraControls && <div className="cmf-extra">{extraControls}</div>}
        </div>
    )
}
