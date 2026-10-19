import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Plus, Save, Trash2, CheckCircle2, RefreshCw, AlertTriangle, FileSpreadsheet, FileText
} from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import {
    getTranscriptPresets,
    createTranscriptPreset,
    updateTranscriptPreset,
    deleteTranscriptPreset,
    activateTranscriptPreset,
} from '../../services/transcriptPresetService'
import './TranscriptPresetsPage.css'

/* ================================================================
   TranscriptPresetsPage — FT-57 (UC-79 Create, UC-81 Activate)
   Admin quản lý preset ánh xạ cột Excel bảng điểm FAP → trường hệ thống.

   1 TRANG DUY NHẤT dùng chung cho Tạo mới và Sửa:
     - Panel trái  = "Bảng chọn preset"           → chọn preset để sửa,
                      hoặc bấm "+ Preset mới" để chuyển form sang chế
                      độ tạo mới (không tách route/trang riêng).
     - Panel phải  = "Bảng edit hoặc add preset"  → form dùng chung,
                      đổi nội dung tuỳ theo preset đang chọn / đang tạo.
     - Action bar dưới panel phải: Kích hoạt | Xóa | Lưu

   API thật (thành call API thực tế từ transcriptPresetService):
     GET    /api/admin/transcript-presets
     POST   /api/admin/transcript-presets
     PUT    /api/admin/transcript-presets/{id}
     DELETE /api/admin/transcript-presets/{id}
     PATCH  /api/admin/transcript-presets/{id}/activate
================================================================ */

const SYSTEM_FIELDS = [
    { key: 'no', label: 'STT', enLabel: 'No', required: false },
    { key: 'term', label: 'Kỳ', enLabel: 'Term', required: true },
    { key: 'semester', label: 'Học kỳ', enLabel: 'Semester', required: false },
    { key: 'subject_code', label: 'Mã môn', enLabel: 'Subject Code', required: true, aliases: ['courseCode', 'course_code'] },
    { key: 'prerequisite', label: 'Môn tiên quyết', enLabel: 'Prerequisite', required: false },
    { key: 'replaced_subject', label: 'Môn thay thế', enLabel: 'Replaced Subject', required: false },
    { key: 'subject_name', label: 'Tên môn', enLabel: 'Subject Name', required: true, aliases: ['courseName', 'course_name'] },
    { key: 'credit', label: 'Số tín chỉ', enLabel: 'Credit', required: true, aliases: ['credits'] },
    { key: 'grade', label: 'Điểm', enLabel: 'Grade', required: true },
    { key: 'status', label: 'Trạng thái', enLabel: 'Status', required: true },
]

/* Preset mặc định do DataSeeder tạo dùng key `courseCode`, còn SYSTEM_FIELDS ở FE
   khai `subject_code` — nên cột "Mã môn" luôn trống dù preset có dữ liệu (DEF_204).
   Đọc theo alias để tương thích cả 2 cách đặt tên. */
function readMapping(columnMapping, field) {
    if (!columnMapping) return ''
    const keys = [field.key, ...(field.aliases || [])]
    for (const k of keys) {
        if (columnMapping[k]) return columnMapping[k]
    }
    return ''
}

const PRESET_NAME_MAX = 100

const MAX_PRESETS = 5

const emptyMapping = () =>
    SYSTEM_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})

function mappedCount(mapping) {
    if (!mapping) return 0
    return Object.values(mapping).filter((v) => v && v.trim() !== '').length
}

export default function TranscriptPresetsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Admin'

    const [presets, setPresets] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    const { toasts, showToast, dismissToast } = useCmToast()

    /* selectedId = null → đang ở chế độ Tạo mới. Ngược lại → đang sửa preset đó. */
    const [selectedId, setSelectedId] = useState(null)
    const [form, setForm] = useState({ presetName: '', columnMapping: emptyMapping() })
    const [formError, setFormError] = useState('')
    const [deleteArmed, setDeleteArmed] = useState(false)
    const [saving, setSaving] = useState(false)

    const selectedPreset = presets.find((p) => p.id === selectedId) ?? null
    const isCreateMode = selectedId === null

    const handleLogout = async () => { await logout(); navigate('/login') }

    /* ── GET /api/admin/transcript-presets ── */
    const loadPresets = async () => {
        setLoading(true)
        setLoadError('')
        try {
            const data = await getTranscriptPresets()
            setPresets(data)
            if (data.length > 0) {
                setSelectedId(data[0].id)
                setForm({ presetName: data[0].presetName, columnMapping: { ...data[0].columnMapping } })
            } else {
                setSelectedId(null)
                setForm({ presetName: '', columnMapping: emptyMapping() })
            }
        } catch (err) {
            setLoadError(
                err?.response?.data?.message || 'Không tải được danh sách preset. Vui lòng thử lại.'
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPresets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const selectPreset = (preset) => {
        setSelectedId(preset.id)
        setForm({ presetName: preset.presetName, columnMapping: { ...preset.columnMapping } })
        setFormError('')
        setDeleteArmed(false)
    }

    const startCreate = () => {
        if (presets.length >= MAX_PRESETS) {
            showToast(`Đã đạt giới hạn ${MAX_PRESETS} preset. Xóa preset cũ trước khi tạo mới.`, 'warning')
            return
        }
        setSelectedId(null)
        setForm({ presetName: '', columnMapping: emptyMapping() })
        setFormError('')
        setDeleteArmed(false)
    }

    const updateMappingField = (key, value) => {
        setForm((f) => ({ ...f, columnMapping: { ...f.columnMapping, [key]: value } }))
    }

    const handleSave = async () => {
        const trimmedName = form.presetName.trim()
        if (!trimmedName) {
            setFormError('Vui lòng nhập tên preset.')
            return
        }
        if (trimmedName.length > PRESET_NAME_MAX) {
            // DB giới hạn 100 ký tự, trước đây không chặn ở client (DEF_205)
            setFormError(`Tên preset không được vượt quá ${PRESET_NAME_MAX} ký tự.`)
            return
        }
        // FDS yêu cầu chặn trùng tên ngay ở client (DEF_206)
        const duplicated = presets.some(
            (x) => x.id !== selectedId && (x.presetName || '').trim().toLowerCase() === trimmedName.toLowerCase()
        )
        if (duplicated) {
            setFormError('Tên preset này đã tồn tại. Vui lòng đặt tên khác.')
            return
        }

        // Validate required system fields
        const missingRequired = SYSTEM_FIELDS.filter(f => f.required && !readMapping(form.columnMapping, f).trim())
        if (missingRequired.length > 0) {
            setFormError(
                `Vui lòng ánh xạ tất cả các trường bắt buộc: ${missingRequired.map(f => f.label).join(', ')}`
            )
            return
        }
        setFormError('')
        setSaving(true)

        const payload = { presetName: trimmedName, columnMapping: form.columnMapping }

        try {
            if (isCreateMode) {
                const created = await createTranscriptPreset(payload)
                setPresets((prev) => [...prev, created])
                setSelectedId(created.id)
                showToast('Đã tạo preset mới.')
            } else {
                const updated = await updateTranscriptPreset(selectedId, payload)
                setPresets((prev) => prev.map((p) => (p.id === selectedId ? updated : p)))
                showToast('Đã lưu thay đổi preset.')
            }
        } catch (err) {
            const msg = err?.response?.data?.message
            setFormError(
                msg || (isCreateMode ? 'Không tạo được preset. Vui lòng thử lại.' : 'Không lưu được thay đổi. Vui lòng thử lại.')
            )
        } finally {
            setSaving(false)
        }
    }

    const handleActivate = async () => {
        if (!selectedPreset || selectedPreset.isActive) return
        try {
            await activateTranscriptPreset(selectedPreset.id)
            setPresets((prev) => prev.map((p) => ({ ...p, isActive: p.id === selectedPreset.id })))
            showToast(`Đã kích hoạt "${selectedPreset.presetName}" làm preset mặc định cho parse.`)
        } catch (err) {
            showToast(err?.response?.data?.message || 'Không kích hoạt được preset. Vui lòng thử lại.', 'error')
        }
    }

    const handleDeleteClick = async () => {
        if (!selectedPreset) return
        if (!deleteArmed) {
            setDeleteArmed(true)
            setTimeout(() => setDeleteArmed(false), 4000)
            return
        }
        try {
            await deleteTranscriptPreset(selectedPreset.id)
            const remaining = presets.filter((p) => p.id !== selectedPreset.id)
            setPresets(remaining)
            showToast(`Đã xóa preset "${selectedPreset.presetName}".`)
            setDeleteArmed(false)
            if (remaining.length > 0) {
                selectPreset(remaining[0])
            } else {
                setSelectedId(null)
                setForm({ presetName: '', columnMapping: emptyMapping() })
            }
        } catch (err) {
            setDeleteArmed(false)
            showToast(err?.response?.data?.message || 'Không xóa được preset. Vui lòng thử lại.', 'error')
        }
    }

    const limitReached = presets.length >= MAX_PRESETS
    const modalMappedCount = useMemo(() => mappedCount(form.columnMapping), [form.columnMapping])

    const canActivate = selectedPreset && !selectedPreset.isActive
    const canDelete = selectedPreset && !selectedPreset.isActive && !selectedPreset.isDefault

    return (
        <Layout
            role="admin"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="tp-page">

                <div className="tp-header">
                    <span className="tp-header-icon"><FileText size={20} strokeWidth={2.2} /></span>
                    <div>
                        <h1 className="tp-title">Cấu hình bảng điểm</h1>
                        <p className="tp-subtitle">
                            Ánh xạ cột trong file bảng điểm sinh viên tải lên sang trường dữ liệu của hệ thống
                        </p>
                    </div>
                </div>

                {loading && (
                    <div className="tp-loading">Đang tải danh sách preset…</div>
                )}

                {!loading && loadError && (
                    <div className="tp-load-error">
                        <span><AlertTriangle size={15} strokeWidth={2.4} /> {loadError}</span>
                        <button className="cm-btn cm-btn--secondary cm-btn--sm" onClick={loadPresets} type="button">
                            <RefreshCw size={13} strokeWidth={2.4} /> Thử lại
                        </button>
                    </div>
                )}

                {!loading && !loadError && (
                    <div className="tp-split">

                        <div className="tp-list-panel">
                            <div className="tp-panel-head">
                                <span className="tp-panel-title">Bảng chọn preset</span>
                                <span className="tp-panel-quota">{presets.length} / {MAX_PRESETS}</span>
                            </div>

                            <button
                                className="tp-btn-new"
                                onClick={startCreate}
                                disabled={limitReached}
                                type="button"
                                title={limitReached ? `Đã đạt giới hạn ${MAX_PRESETS} preset` : undefined}
                            >
                                <Plus size={14} strokeWidth={2.6} /> Preset mới
                            </button>

                            <div className="tp-list-body">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        className={`tp-list-row${preset.id === selectedId ? ' tp-list-row--selected' : ''}`}
                                        onClick={() => selectPreset(preset)}
                                        type="button"
                                    >
                                        <div className="tp-list-row-top">
                                            <span className="tp-list-row-name">{preset.presetName}</span>
                                            {preset.isActive && <span className="tp-dot tp-dot--active" title="Đang áp dụng" />}
                                        </div>
                                        <div className="tp-list-row-bottom">
                                            <span className="tp-list-row-meta">{mappedCount(preset.columnMapping)}/{SYSTEM_FIELDS.length} cột</span>
                                            {preset.isDefault && <span className="tp-mini-badge">Mặc định</span>}
                                        </div>
                                    </button>
                                ))}

                                {isCreateMode && (
                                    <div className="tp-list-row tp-list-row--drafting">
                                        <div className="tp-list-row-top">
                                            <span className="tp-list-row-name">{form.presetName || 'Preset mới'}</span>
                                        </div>
                                        <div className="tp-list-row-bottom">
                                            <span className="tp-list-row-meta">đang soạn thảo</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {limitReached && (
                                <p className="tp-quota-warn-txt">Đã đạt giới hạn {MAX_PRESETS} preset — xóa preset cũ để tạo mới.</p>
                            )}
                        </div>

                        <div className="tp-form-panel">
                            <div className="tp-panel-head">
                                <span className="tp-panel-title">
                                    {isCreateMode ? 'Tạo preset mới' : `Sửa preset — ${selectedPreset?.presetName}`}
                                </span>
                                <div className="tp-badges">
                                    {selectedPreset?.isActive && <span className="tp-badge tp-badge--active">Đang áp dụng</span>}
                                    {selectedPreset?.isDefault && <span className="tp-badge tp-badge--default">Mặc định hệ thống</span>}
                                </div>
                            </div>

                            <div className="tp-form-body">
                                <label className="tp-field">
                                    <span className="tp-field-lbl">Tên preset</span>
                                    <input
                                        className="tp-input"
                                        type="text"
                                        value={form.presetName}
                                        maxLength={PRESET_NAME_MAX}
                                        onChange={(e) => setForm((f) => ({ ...f, presetName: e.target.value }))}
                                        placeholder="VD: FPT Standard 2026"
                                    />
                                </label>

                                <div className="tp-mapping-editor">
                                    <div className="tp-mapping-editor-head">
                                        <span>Trường hệ thống</span>
                                        <span>Tên cột trong file Excel</span>
                                    </div>
                                    {SYSTEM_FIELDS.map((f) => (
                                        <div key={f.key} className="tp-mapping-editor-row">
                                            <div className="tp-mapping-editor-field">
                                                <span>{f.label}</span>
                                                <span className="tp-mapping-editor-en">{f.enLabel}</span>
                                                {f.required && <span className="tp-required-dot" title="Bắt buộc" />}
                                            </div>
                                            <input
                                                className="tp-input tp-input-sm"
                                                type="text"
                                                value={readMapping(form.columnMapping, f)}
                                                onChange={(e) => updateMappingField(f.key, e.target.value)}
                                                placeholder={f.enLabel}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="tp-modal-footnote">
                                    Đã ánh xạ {modalMappedCount} / {SYSTEM_FIELDS.length} trường ·
                                    <span className="tp-required-dot" /> = bắt buộc
                                </div>

                                {formError && (
                                    <div className="tp-form-error">
                                        <AlertTriangle size={14} strokeWidth={2.4} /> {formError}
                                    </div>
                                )}
                            </div>

                            <div className="tp-action-bar">
                                <button
                                    className="tp-action-btn"
                                    onClick={handleActivate}
                                    disabled={!canActivate}
                                    type="button"
                                    title={
                                        !selectedPreset
                                            ? 'Lưu preset trước khi kích hoạt'
                                            : selectedPreset.isActive
                                                ? 'Preset này đang active'
                                                : undefined
                                    }
                                >
                                    <CheckCircle2 size={14} strokeWidth={2.4} /> Kích hoạt
                                </button>
                                <button
                                    className={`tp-action-btn tp-action-btn--danger${deleteArmed ? ' tp-action-btn--armed' : ''}`}
                                    onClick={handleDeleteClick}
                                    disabled={!canDelete}
                                    type="button"
                                    title={
                                        !selectedPreset
                                            ? 'Chưa có preset để xóa'
                                            : selectedPreset.isActive
                                                ? 'Không thể xóa preset đang active'
                                                : selectedPreset.isDefault
                                                    ? 'Không thể xóa preset mặc định hệ thống'
                                                    : undefined
                                    }
                                >
                                    <Trash2 size={14} strokeWidth={2.4} /> {deleteArmed ? 'Xác nhận xóa?' : 'Xóa'}
                                </button>
                                <button
                                    className="tp-action-btn tp-action-btn--primary"
                                    onClick={handleSave}
                                    disabled={saving}
                                    type="button"
                                >
                                    <Save size={14} strokeWidth={2.4} /> {saving ? 'Đang lưu…' : 'Lưu'}
                                </button>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}
