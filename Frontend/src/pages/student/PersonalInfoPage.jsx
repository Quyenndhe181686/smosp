import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, User, Save, RotateCcw, Sparkles } from 'lucide-react'
import { logout, getProfile } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization } from '../../services/catalogService'
import { getStudentProfile, updateStudentProfile } from '../../services/studentService'
import { ProfileFlowFooter, ProfileFlowToast } from '../../components/student/ProfileFlowNav'
import { refreshProfileFlow } from '../../components/student/profileFlow'
import './PersonalInfoPage.css'

const TERMS = Array.from({ length: 9 }, (_, i) => i + 1)
// Mã sinh viên theo quy ước trường: 2 chữ cái ngành + 6 chữ số (vd SE123456)
const STUDENT_CODE_PATTERN = /^[A-Za-z]{2}\d{6}$/

export default function PersonalInfoPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Sinh viên'

    const [majors, setMajors] = useState([])
    const [specializations, setSpecializations] = useState([])
    const [narrowSpecs, setNarrowSpecs] = useState([])

    const [form, setForm] = useState({
        fullName: '',
        studentCode: '',
        email: '',
        majorId: '',
        specializationId: '',
        term: '',
        currentNarrowSpecId: ''
    })
    const [initialSpecId, setInitialSpecId] = useState('')
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [showMatchWarning, setShowMatchWarning] = useState(true)
    const [errors, setErrors] = useState({})
    const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
    const [toast, setToast] = useState(null)

    // Load initial catalogs and student profile
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Get active majors
                const majorsData = await getMajors()
                const activeMajors = majorsData.filter(m => m.isActive)
                setMajors(activeMajors)

                // Get student profile
                const profile = await getStudentProfile()
                setForm({
                    fullName: profile.fullName || '',
                    studentCode: profile.studentCode || '',
                    email: localStorage.getItem('email') || '',
                    majorId: profile.majorId || '',
                    specializationId: profile.specializationId || '',
                    // currentTerm chưa khai báo thì để trống, không mặc định "Kỳ 1" (DEF_107)
                    term: profile.currentTerm ?? '',
                    currentNarrowSpecId: profile.currentNarrowSpecId || ''
                })
                setInitialSpecId(profile.specializationId || '')
            } catch (err) {
                console.error("Failed to load profile:", err)
            }

            // Email lấy từ tài khoản (/me), không phải localStorage — localStorage chỉ có
            // sau khi đăng nhập Google nên trước đây ô này luôn trống (DEF_107)
            try {
                const account = await getProfile()
                if (account?.identifier) {
                    localStorage.setItem('email', account.identifier)
                    setForm((prev) => ({ ...prev, email: account.identifier }))
                }
            } catch (err) {
                console.error("Failed to load account email:", err)
            }
        }

        loadInitialData()
    }, [])

    // Load specializations when major changes
    useEffect(() => {
        if (!form.majorId) return
        getSpecializationsByMajor(form.majorId)
            .then(data => {
                setSpecializations(data.filter(s => s.isActive))
            })
            .catch(err => console.error("Failed to load specs:", err))
    }, [form.majorId])

    // Load narrow specs when specialization changes
    useEffect(() => {
        if (!form.specializationId || parseInt(form.term) < 5) {
            setNarrowSpecs([])
            return
        }
        getNarrowSpecsBySpecialization(form.specializationId)
            .then(data => {
                setNarrowSpecs(data.filter(n => n.isPublished))
            })
            .catch(err => console.error("Failed to load narrow specs:", err))
    }, [form.specializationId, form.term])

    const handleField = useCallback((field) => (e) => {
        const value = e.target.value
        setForm((prev) => ({ ...prev, [field]: value }))
        setErrors((prev) => ({ ...prev, [field]: undefined }))
    }, [])

    const handleMajorChange = useCallback((e) => {
        const majorId = e.target.value
        setForm((prev) => ({ ...prev, majorId, specializationId: '', currentNarrowSpecId: '' }))
        setErrors((prev) => ({ ...prev, majorId: undefined, specializationId: undefined }))
    }, [])

    // Đổi Chuyên ngành thì CN hẹp cũ không còn hợp lệ — phải xoá thay vì gửi kèm id cũ (DEF_111)
    const handleSpecChange = useCallback((e) => {
        const specializationId = e.target.value
        setForm((prev) => ({ ...prev, specializationId, currentNarrowSpecId: '' }))
        setErrors((prev) => ({ ...prev, specializationId: undefined }))
    }, [])

    // Hạ Kỳ học xuống dưới 5 sẽ xoá CN hẹp đã chọn — phải hỏi trước, không xoá âm thầm (DEF_112)
    const handleTermChange = useCallback((e) => {
        const term = e.target.value
        setErrors((prev) => ({ ...prev, term: undefined }))
        setForm((prev) => {
            const dropsNarrowSpec = prev.currentNarrowSpecId && Number(term) < 5
            if (dropsNarrowSpec) {
                const ok = window.confirm(
                    'Chuyên ngành hẹp chỉ áp dụng từ Kỳ 5 trở đi. Hạ xuống Kỳ ' + term +
                    ' sẽ xoá chuyên ngành hẹp bạn đã chọn. Bạn có chắc chắn không?'
                )
                if (!ok) return prev
                return { ...prev, term, currentNarrowSpecId: '' }
            }
            return { ...prev, term }
        })
    }, [])

    const validate = useCallback(() => {
        const next = {}
        if (!form.fullName.trim()) next.fullName = 'Vui lòng nhập họ và tên'
        if (!form.majorId) next.majorId = 'Vui lòng chọn khối ngành'
        if (!form.specializationId) next.specializationId = 'Vui lòng chọn chuyên ngành'
        if (!form.term) next.term = 'Vui lòng chọn kỳ học hiện tại'
        // Mã sinh viên là tuỳ chọn, nhưng đã nhập thì phải đúng định dạng (DEF_110)
        if (form.studentCode.trim() && !STUDENT_CODE_PATTERN.test(form.studentCode.trim())) {
            next.studentCode = 'Mã sinh viên phải gồm 2 chữ cái và 6 chữ số, ví dụ SE123456'
        }
        setErrors(next)
        return Object.keys(next).length === 0
    }, [form])

    const saveProfileData = useCallback(async (shouldClear) => {
        setShowConfirmModal(false)
        setSaveState('saving')

        try {
            const payload = {
                fullName: form.fullName,
                studentCode: form.studentCode.trim() || null,
                majorId: form.majorId,
                specializationId: form.specializationId,
                currentTerm: parseInt(form.term),
                currentNarrowSpecId: parseInt(form.term) >= 5 && form.currentNarrowSpecId ? form.currentNarrowSpecId : null
            }

            await updateStudentProfile(payload)

            let clearFailed = false;

            localStorage.setItem('username', form.fullName)
            setInitialSpecId(form.specializationId)



            setSaveState('saved')
            setToast({
                message: shouldClear
                    ? 'Đã cập nhật chuyên ngành và làm mới dữ liệu khai báo!'
                    : 'Lưu thông tin cá nhân thành công!',
                type: 'success'
            })
            refreshProfileFlow()
            setTimeout(() => setSaveState('idle'), 2500)
            setTimeout(() => setToast(null), 3500)
        } catch (err) {
            console.error("Failed to save profile:", err)
            setSaveState('error')
            // Map theo mã lỗi thật thay vì luôn dùng 1 thông điệp chung chung (DEF_108)
            const status = err.response?.status
            const serverMsg = err.response?.data?.message
            const errMsg =
                status === 400 ? (serverMsg || 'Thông tin bạn nhập chưa hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc.')
                    : status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi lưu.'
                        : status === 403 ? 'Bạn không có quyền cập nhật hồ sơ này.'
                            : status === 404 ? 'Không tìm thấy hồ sơ sinh viên của bạn trên hệ thống.'
                                : status === 409 ? (serverMsg || 'Mã sinh viên này đã được tài khoản khác sử dụng.')
                                    : status >= 500 ? 'Hệ thống đang gặp sự cố khi lưu hồ sơ. Vui lòng thử lại sau ít phút.'
                                        : (serverMsg || 'Có lỗi xảy ra khi lưu thông tin cá nhân.')
            setErrors({ submit: errMsg })
            setToast({ message: errMsg, type: 'error' })
            setTimeout(() => setSaveState('idle'), 3000)
            setTimeout(() => setToast(null), 4000)
        }
    }, [form])

    const handleSubmit = useCallback((e) => {
        e.preventDefault()
        if (!validate()) return

        const specChanged = initialSpecId && String(form.specializationId) !== String(initialSpecId)
        if (specChanged) {
            setShowConfirmModal(true)
        } else {
            saveProfileData(false)
        }
    }, [validate, initialSpecId, form.specializationId, saveProfileData])

    const handleCancel = useCallback(() => {
        window.location.reload()
    }, [])

    const handleLogout = async () => { await logout(); navigate('/login') }

    return (
        <Layout
            role="student"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <ProfileFlowToast toast={toast} onClose={() => setToast(null)} />

            {showConfirmModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: '20px'
                    }}
                >
                    <div
                        style={{
                            background: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '26px',
                            maxWidth: '460px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            fontFamily: "'Be Vietnam Pro', sans-serif"
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FFF3E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle color="#F37021" size={24} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                                Xác nhận đổi chuyên ngành
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
                            Khi thay đổi chuyên ngành, hệ thống sẽ <strong>làm mới dữ liệu Kỹ năng và Sở thích</strong> đã khai báo trước đó để đảm bảo tính phù hợp với chương trình đào tạo mới. Bảng điểm đã tải lên của bạn vẫn được giữ nguyên.
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    color: '#334155',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={() => saveProfileData(true)}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #F37021 0%, #D95F14 100%)',
                                    color: '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(243, 112, 33, 0.25)'
                                }}
                            >
                                Xác nhận &amp; Làm mới
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="pi-page">
                <ProfileFlowFooter current="personalInfo" />

                <div className="pi-head">
                    <h1 className="pi-title">
                        <span className="pi-title-icon"><User size={20} strokeWidth={2.5} /></span>
                        Thông tin cá nhân
                    </h1>
                </div>

                {showMatchWarning && (
                    <div className="pi-match-warning">
                        <div className="pi-match-warning-icon">
                            <AlertTriangle size={18} strokeWidth={2.4} />
                        </div>
                        <div className="pi-match-warning-body">
                            <strong className="pi-match-warning-title">Lưu ý quan trọng:</strong>
                            <span className="pi-match-warning-text">
                                Thông tin cá nhân (<strong>Họ và tên</strong>, <strong>Mã sinh viên</strong>, <strong>Khối ngành</strong>, <strong>Chuyên ngành</strong>) phải <strong>trùng khớp chính xác với Bảng điểm</strong> để hệ thống đối soát dữ liệu môn học và gợi ý chuyên ngành hẹp chính xác nhất.
                            </span>
                        </div>
                        <button
                            type="button"
                            className="pi-match-warning-close"
                            onClick={() => setShowMatchWarning(false)}
                            aria-label="Đóng thông báo"
                            title="Đóng thông báo"
                        >
                            &times;
                        </button>
                    </div>
                )}

                <form className="pi-layout" onSubmit={handleSubmit} noValidate>
                    <div className="pi-card" style={{ position: 'relative' }}>

                        <div className="pi-form-grid">
                            {/* Cột trái: khối ngành, chuyên ngành, kỳ */}
                            <div className="pi-form-col">
                                <div className="pi-field">
                                    <label className="pi-label" htmlFor="major">
                                        Khối ngành <span className="pi-required">*</span>
                                    </label>
                                    <select
                                        id="major"
                                        className={`pi-select${errors.majorId ? ' pi-input-error' : ''}`}
                                        value={form.majorId}
                                        onChange={handleMajorChange}
                                    >
                                        <option value="">-- Chọn Khối ngành --</option>
                                        {majors.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.code})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.majorId && <span className="pi-error-msg">{errors.majorId}</span>}
                                </div>

                                <div className="pi-field">
                                    <label className="pi-label" htmlFor="specialization">
                                        Chuyên ngành <span className="pi-required">*</span>
                                    </label>
                                    <select
                                        id="specialization"
                                        className={`pi-select${errors.specializationId ? ' pi-input-error' : ''}`}
                                        value={form.specializationId}
                                        onChange={handleSpecChange}
                                        disabled={!form.majorId}
                                    >
                                        <option value="">-- Chọn Chuyên ngành --</option>
                                        {specializations.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.specializationId && <span className="pi-error-msg">{errors.specializationId}</span>}
                                </div>

                                <div className="pi-field">
                                    <label className="pi-label" htmlFor="term">
                                        Kỳ học hiện tại <span className="pi-required">*</span>
                                    </label>
                                    <select
                                        id="term"
                                        className={`pi-select${errors.term ? ' pi-input-error' : ''}`}
                                        value={form.term}
                                        onChange={handleTermChange}
                                    >
                                        <option value="">-- Chọn Kỳ học --</option>
                                        {TERMS.map((t) => (
                                            <option key={t} value={t}>
                                                Kỳ {t}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.term && <span className="pi-error-msg">{errors.term}</span>}
                                </div>
                            </div>

                            {/* Cột phải: họ tên, mã sv, email */}
                            <div className="pi-form-col">
                                <div className="pi-field">
                                    <label className="pi-label" htmlFor="fullName">
                                        Họ và tên <span className="pi-required">*</span>
                                    </label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        className={`pi-input${errors.fullName ? ' pi-input-error' : ''}`}
                                        placeholder="Ví dụ: Nguyễn Văn A"
                                        value={form.fullName}
                                        onChange={handleField('fullName')}
                                    />
                                    {errors.fullName && <span className="pi-error-msg">{errors.fullName}</span>}
                                </div>

                                <div className="pi-field">
                                    <label className="pi-label" htmlFor="studentCode">
                                        Mã sinh viên
                                    </label>
                                    <input
                                        id="studentCode"
                                        type="text"
                                        className={`pi-input${errors.studentCode ? ' pi-input-error' : ''}`}
                                        placeholder="Ví dụ: SE123456"
                                        value={form.studentCode}
                                        onChange={handleField('studentCode')}
                                        maxLength={20}
                                    />
                                    {errors.studentCode && <span className="pi-error-msg">{errors.studentCode}</span>}
                                </div>

                                <div className="pi-field">
                                    <label className="pi-label" htmlFor="email">
                                        Email sinh viên
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        className="pi-input pi-readonly"
                                        value={form.email}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dưới cả 2 cột: chọn chuyên ngành hẹp */}
                        <div className="pi-narrow-spec-section">
                            <label className="pi-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={16} color="#F37021" />
                                Chọn chuyên ngành hẹp (tùy chọn)
                            </label>

                            {parseInt(form.term) < 5 ? (
                                <div className="pi-narrow-spec-notice">
                                    Chuyên ngành hẹp được chọn từ <strong>Kỳ 5 trở đi</strong>. Hiện tại bạn đang ở Kỳ {form.term}.
                                </div>
                            ) : !form.specializationId ? (
                                <div className="pi-narrow-spec-notice">
                                    Vui lòng chọn <strong>Chuyên ngành</strong> để xem danh sách chuyên ngành hẹp.
                                </div>
                            ) : narrowSpecs.length === 0 ? (
                                <div className="pi-narrow-spec-notice">
                                    Chuyên ngành này hiện chưa có chuyên ngành hẹp.
                                </div>
                            ) : (
                                <div className="pi-narrow-spec-grid">
                                    {narrowSpecs.map((n) => {
                                        const isSelected = String(form.currentNarrowSpecId) === String(n.id);
                                        return (
                                            <div
                                                key={n.id}
                                                className={`pi-cnh-box ${isSelected ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        currentNarrowSpecId: isSelected ? '' : n.id
                                                    }))
                                                }}
                                            >
                                                <div className="pi-cnh-checkbox">
                                                    {isSelected && (
                                                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="1.5 5 4.5 8 10.5 1.5" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="pi-cnh-content">
                                                    <span className="pi-cnh-name">{n.name}</span>
                                                    {n.code && <span className="pi-cnh-code">({n.code})</span>}
                                                    {n.description && <p className="pi-cnh-desc">{n.description}</p>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {errors.submit && <div className="pi-error-msg" style={{ marginTop: '16px', display: 'block' }}>{errors.submit}</div>}

                        <div className="pi-actions">
                            {/* Xác nhận rõ ràng sau khi lưu thành công (DEF_108) */}
                            {saveState === 'saved' && (
                                <span
                                    className="pi-saved-badge"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        marginRight: 'auto', padding: '6px 12px', borderRadius: '999px',
                                        background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0',
                                        fontSize: '12.5px', fontWeight: 700
                                    }}
                                >
                                    <Save size={13} />
                                    Đã lưu thay đổi
                                </span>
                            )}
                            <button type="button" className="pi-btn-ghost" onClick={handleCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <RotateCcw size={15} />
                                Hủy thay đổi
                            </button>
                            <button type="submit" className="pi-btn-primary" disabled={saveState === 'saving'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Save size={15} />
                                {saveState === 'saving' ? 'Đang lưu…' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </Layout>
    )
}
