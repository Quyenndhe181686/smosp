import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Heart, Save, CheckCheck, X } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import {
    getStudentProfile,
    getStudentInterestOptions,
    getDeclaredInterests,
    updateDeclaredInterests
} from '../../services/studentService'
import { ProfileFlowFooter, ProfileFlowToast, ProfileIncompleteNotice } from '../../components/student/ProfileFlowNav'
import { refreshProfileFlow } from '../../components/student/profileFlow'
import './DeclareInterestsPage.css'

export default function DeclareInterestsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Sinh viên'

    const [allInterests, setAllInterests] = useState([])
    const [selected, setSelected] = useState(new Set())
    // Sở thích đã khai báo nhưng CM đã tắt -> không còn trong allInterests (DEF_126)
    const [inactiveSelected, setInactiveSelected] = useState([])
    const [specializationName, setSpecializationName] = useState('')
    const [profileIncomplete, setProfileIncomplete] = useState(false)
    const [optionsError, setOptionsError] = useState(null)
    const [declaredError, setDeclaredError] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)
    const [saveState, setSaveState] = useState('idle') // idle | saving | saved
    const [toast, setToast] = useState(null)
    const [showImpactBanner, setShowImpactBanner] = useState(true)
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)
    const pageSize = 30

    // Reset page to 1 on query change
    useEffect(() => {
        setPage(1)
    }, [query])

    // Load initial data
    useEffect(() => {
        const loadInitialData = async () => {
            // 1. Tải profile (bắt lỗi riêng để không block các hàm sau)
            try {
                const profile = await getStudentProfile()
                if (!profile.fullName || !profile.majorId || !profile.specializationId) {
                    setProfileIncomplete(true)
                }

                if (profile.specializationName) {
                    setSpecializationName(profile.specializationName)
                } else if (profile.specializationCode) {
                    setSpecializationName(profile.specializationCode)
                } else {
                    setSpecializationName('Tất cả chuyên ngành')
                }
            } catch (err) {
                console.error("Failed to load interests profile:", err)
                if (err.response?.status === 404) {
                    setProfileIncomplete(true)
                    setSpecializationName('Chưa có chuyên ngành')
                } else {
                    setOptionsError(err.response?.data?.message || 'Không tải được hồ sơ của bạn.')
                }
            }

            // 2. Tải danh mục sở thích
            let mapped = []
            try {
                const optionsData = await getStudentInterestOptions()
                mapped = optionsData.map(it => ({ ...it, name: it.name || it.label || '' }))
                setAllInterests(mapped)
                setOptionsError(null)
            } catch (e) {
                console.error("Failed to load interest options:", e)
                setOptionsError(e.response?.data?.message || 'Không tải được danh mục sở thích từ hệ thống.')
            }

            // 3. Tải danh sách sở thích đã khai báo
            try {
                const declaredData = await getDeclaredInterests()
                const declaredIds = declaredData.map(i => i.id)
                setSelected(new Set(declaredIds))
                // Mục đã khai báo nhưng không còn trong danh mục đang hoạt động = đã bị CM tắt
                const activeIds = new Set(mapped.map(it => it.id))
                setInactiveSelected(
                    declaredData
                        .filter(i => !activeIds.has(i.id))
                        .map(i => ({ ...i, name: i.name || i.label || '' }))
                )
                setDeclaredError(null)
            } catch (e) {
                console.error("Failed to load declared interests:", e)
                if (e.response && e.response.status === 404) {
                    // Chưa khai báo bao giờ
                    setDeclaredError(null)
                } else {
                    // Không được để bộ đếm về 0 như thể Student chưa khai báo gì (DEF_127)
                    setDeclaredError(e.response?.data?.message || 'Không tải được danh sách sở thích bạn đã khai báo.')
                }
            }
        }

        loadInitialData()
    }, [reloadKey])

    const getVietnameseInitial = (name) => {
        if (!name) return '#'
        return name.trim().charAt(0).toUpperCase()
    }

    const sortedInterests = useMemo(() => {
        let list = allInterests
        if (query.trim()) {
            const q = query.toLowerCase()
            list = list.filter(it => (it.name || it.label || '').toLowerCase().includes(q))
        }
        return [...list].sort((a, b) => (a.name || a.label || '').localeCompare(b.name || b.label || '', 'vi'))
    }, [allInterests, query])

    const totalPages = Math.ceil(sortedInterests.length / pageSize) || 1

    const pagedInterests = useMemo(() => {
        const start = (page - 1) * pageSize
        return sortedInterests.slice(start, start + pageSize)
    }, [sortedInterests, page, pageSize])

    const interestColumns = useMemo(() => {
        if (!pagedInterests.length) return [[], [], []]
        const colSize = Math.ceil(pagedInterests.length / 3)
        return [
            pagedInterests.slice(0, colSize),
            pagedInterests.slice(colSize, colSize * 2),
            pagedInterests.slice(colSize * 2)
        ]
    }, [pagedInterests])

    const toggle = useCallback((id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const handleSelectAllInterests = useCallback(() => {
        setSelected((prev) => {
            const next = new Set(prev)
            sortedInterests.forEach(it => next.add(it.id))
            return next
        })
    }, [sortedInterests])

    const handleClearAllInterests = useCallback(() => {
        setSelected((prev) => {
            const next = new Set(prev)
            sortedInterests.forEach(it => next.delete(it.id))
            return next
        })
    }, [sortedInterests])

    const handleToggleAllInterests = useCallback(() => {
        setSelected((prev) => {
            const next = new Set(prev)
            const allCurrentSelected = sortedInterests.length > 0 && sortedInterests.every(it => next.has(it.id))
            if (allCurrentSelected) {
                sortedInterests.forEach(it => next.delete(it.id))
            } else {
                sortedInterests.forEach(it => next.add(it.id))
            }
            return next
        })
    }, [sortedInterests])

    const isAllInterestsSelected = useMemo(() => {
        if (sortedInterests.length === 0) return false
        return sortedInterests.every(it => selected.has(it.id))
    }, [sortedInterests, selected])

    const handleSave = useCallback(async () => {
        // Không lưu đè khi chưa đọc được danh sách đã khai báo — sẽ xoá nhầm dữ liệu thật (DEF_127)
        if (declaredError) {
            setToast({ message: 'Chưa tải được sở thích đã khai báo, hãy tải lại trước khi lưu để tránh mất dữ liệu.', type: 'error' })
            setTimeout(() => setToast(null), 4000)
            return
        }
        // Cảnh báo trước khi lưu lại mục đã bị Content Manager tắt (DEF_128)
        const stillSelectedInactive = inactiveSelected.filter(it => selected.has(it.id))
        if (stillSelectedInactive.length > 0) {
            const names = stillSelectedInactive.map(it => it.name).join(', ')
            const ok = window.confirm(
                `${stillSelectedInactive.length} sở thích đã bị ngừng sử dụng (${names}) vẫn đang được chọn. ` +
                `Những mục này không còn được tính vào gợi ý. Bạn vẫn muốn lưu?`
            )
            if (!ok) return
        }
        setSaveState('saving')
        try {
            const interestIds = Array.from(selected)
            await updateDeclaredInterests(interestIds)
            setSaveState('saved')
            setToast({ message: 'Lưu danh sách sở thích thành công!', type: 'success' })
            refreshProfileFlow()
            setTimeout(() => setSaveState('idle'), 2500)
            setTimeout(() => setToast(null), 3500)
        } catch (err) {
            console.error("Failed to save interests:", err)
            setSaveState('error')
            const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu danh sách sở thích.'
            setToast({ message: errMsg, type: 'error' })
            setTimeout(() => setSaveState('idle'), 3000)
            setTimeout(() => setToast(null), 4000)
        }
    }, [selected, declaredError, inactiveSelected])

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

            <div className="wi-page">
                <ProfileFlowFooter current="interests" />

                <div className="wi-head">
                    <h1 className="wi-title">
                        <span className="wi-title-icon"><Heart size={20} strokeWidth={2.5} /></span>
                        Sở thích nghề nghiệp
                    </h1>
                </div>

                {/* Cảnh báo mức độ ảnh hưởng đến kết quả gợi ý */}
                {showImpactBanner && (
                    <div className="wi-impact-banner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span style={{ flex: 1 }}>
                            Sở thích bạn lựa chọn sẽ <strong>ảnh hưởng trực tiếp</strong> đến kết quả gợi ý chuyên ngành hẹp.
                            Hãy cân nhắc và lựa chọn chính xác, phù hợp với bản thân để nhận được kết quả giá trị nhất!
                        </span>
                        <button
                            type="button"
                            className="wi-impact-banner-close"
                            onClick={() => setShowImpactBanner(false)}
                            aria-label="Đóng thông báo"
                            title="Đóng thông báo"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {(optionsError || declaredError) && (
                    <div className="wi-impact-banner" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                        <span>
                            {optionsError && <>{optionsError} </>}
                            {declaredError && <>{declaredError} Đây là lỗi tải dữ liệu — các lựa chọn bạn đã lưu trước đó vẫn còn nguyên trên hệ thống. </>}
                            <button
                                type="button"
                                onClick={() => { setOptionsError(null); setDeclaredError(null); setReloadKey(k => k + 1) }}
                                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}
                            >
                                Thử lại
                            </button>
                        </span>
                    </div>
                )}

                <div className="wi-card wi-list-card">
                    <div className="wi-list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <input
                            type="text"
                            className="wi-search"
                            placeholder="Tìm sở thích…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{ marginBottom: 0, maxWidth: '280px', width: '100%' }}
                            disabled={profileIncomplete}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleSelectAllInterests}
                                disabled={profileIncomplete || isAllInterestsSelected}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: (profileIncomplete || isAllInterestsSelected) ? '#94A3B8' : '#FFFFFF',
                                    background: (profileIncomplete || isAllInterestsSelected) ? '#E2E8F0' : '#034EA2',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: (profileIncomplete || isAllInterestsSelected) ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    boxShadow: (profileIncomplete || isAllInterestsSelected) ? 'none' : '0 2px 6px rgba(3, 78, 162, 0.2)'
                                }}
                            >
                                <CheckCheck size={14} />
                                Chọn tất cả
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllInterests}
                                disabled={profileIncomplete || selected.size === 0}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: (profileIncomplete || selected.size === 0) ? '#94A3B8' : '#D95F14',
                                    background: (profileIncomplete || selected.size === 0) ? '#F1F5F9' : '#FFF7ED',
                                    border: (profileIncomplete || selected.size === 0) ? '1px solid #E2E8F0' : '1px solid #FFEDD5',
                                    borderRadius: '8px',
                                    cursor: (profileIncomplete || selected.size === 0) ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <X size={14} />
                                Bỏ chọn
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        {profileIncomplete ? (
                            <div style={{ width: '100%', textAlign: 'center', padding: '16px 0' }}>
                                <ProfileIncompleteNotice />
                            </div>
                        ) : sortedInterests.length === 0 ? (
                            <p className="wi-empty" style={{ width: '100%' }}>
                                {optionsError
                                    ? 'Không tải được danh mục sở thích — hãy bấm "Thử lại" ở trên.'
                                    : query.trim()
                                        ? 'Không tìm thấy sở thích phù hợp với từ khóa.'
                                        : 'Chuyên ngành của bạn chưa có sở thích nào trong danh mục.'}
                            </p>
                        ) : (
                            <div className="wi-columns-container">
                                {interestColumns.map((col, idx) => (
                                    <div key={idx} className="wi-column-card">
                                        {col.map((it) => {
                                            const checked = selected.has(it.id)
                                            return (
                                                <button
                                                    key={it.id}
                                                    type="button"
                                                    className={`wi-pill${checked ? ' wi-pill-checked' : ''}`}
                                                    onClick={() => toggle(it.id)}
                                                    disabled={profileIncomplete}
                                                >
                                                    <span className={`wi-checkbox${checked ? ' wi-checkbox-on' : ''}`} />
                                                    <span>{it.name || it.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && !profileIncomplete && (
                        <div className="wi-pagination">
                            <button
                                type="button"
                                className="wi-page-btn"
                                disabled={page === 1}
                                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                            >
                                <ChevronLeft size={14} /> Trang trước
                            </button>
                            <span className="wi-page-info">
                                Trang {page} / {totalPages}
                            </span>
                            <button
                                type="button"
                                className="wi-page-btn"
                                disabled={page === totalPages}
                                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                Trang sau <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="wi-card wi-footer-bar">
                    <span className="wi-footer-text">
                        {declaredError
                            ? 'Chưa đọc được số sở thích đã khai báo'
                            : `Đã chọn ${selected.size} / ${allInterests.length} sở thích khả dụng`}
                    </span>
                    <div className="wi-footer-actions">
                        <button
                            type="button"
                            className="wi-btn-primary"
                            onClick={handleSave}
                            disabled={saveState === 'saving' || profileIncomplete}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Save size={15} />
                            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu lựa chọn'}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}