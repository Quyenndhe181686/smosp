import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Wrench, Save, CheckCheck, X } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import {
    getStudentProfile,
    getStudentSkillOptions,
    searchStudentSkillOptions,
    getStudentSkillSuggestions,
    getDeclaredSkills,
    updateDeclaredSkills,
    getLatestTranscript
} from '../../services/studentService'
import { ProfileFlowFooter, ProfileFlowAlert, ProfileFlowToast, ProfileIncompleteNotice } from '../../components/student/ProfileFlowNav'
import { refreshProfileFlow } from '../../components/student/profileFlow'
import './DeclareSkillsPage.css'

export default function DeclareSkillsPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Sinh viên'

    const [allSkills, setAllSkills] = useState([])
    const [selected, setSelected] = useState(new Set())
    const [suggestedList, setSuggestedList] = useState([])
    const [specializationName, setSpecializationName] = useState('')
    const [studentSpecId, setStudentSpecId] = useState(null)
    const [hasTranscript, setHasTranscript] = useState(false)
    const [transcriptError, setTranscriptError] = useState(null)
    const [profileIncomplete, setProfileIncomplete] = useState(false)
    const [totalSkillOptions, setTotalSkillOptions] = useState(0)
    const [query, setQuery] = useState('')
    const [saveState, setSaveState] = useState('idle') // idle | saving | saved
    const [toast, setToast] = useState(null)
    const [hoveredSkillId, setHoveredSkillId] = useState(null)
    const [showImpactBanner, setShowImpactBanner] = useState(true)
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 30
    const [sugPage, setSugPage] = useState(1)
    const SUGGESTED_PAGE_SIZE = 12

    const loadSuggestions = useCallback(() => {
        return getStudentSkillSuggestions()
            .then(sug => {
                setSuggestedList(sug)
            })
            .catch(err => console.error("Failed to load skill suggestions:", err))
    }, [])

    // Load initial data
    useEffect(() => {
        getStudentProfile()
            .then(profile => {
                setSpecializationName(profile.specializationName || 'Chưa có chuyên ngành')
                setStudentSpecId(profile.specializationId || null)
                if (!profile.fullName || !profile.majorId || !profile.specializationId) {
                    setProfileIncomplete(true)
                }
            })
            .catch(err => {
                console.error("Failed to load profile:", err)
                if (err.response?.status === 404) {
                    setProfileIncomplete(true)
                }
            })

        getDeclaredSkills()
            .then(declared => {
                setSelected(new Set(declared.map(s => s.id)))
            })
            .catch(err => console.error("Failed to load declared skills:", err))

        loadSuggestions()

        // 404 = thật sự chưa có bảng điểm; các mã khác là lỗi tải, không được báo là "chưa có" (DEF_122)
        getLatestTranscript()
            .then(() => { setHasTranscript(true); setTranscriptError(null) })
            .catch(err => {
                setHasTranscript(false)
                if (err.response && err.response.status === 404) {
                    setTranscriptError(null)
                } else {
                    console.error("Failed to load latest transcript:", err)
                    setTranscriptError(err.response?.data?.message || 'Không kiểm tra được bảng điểm của bạn do lỗi hệ thống.')
                }
            })
    }, [loadSuggestions])

    // Gợi ý còn trả cả kỹ năng chung (specializationId = null) nhưng updateDeclaredSkills lại
    // từ chối chúng -> loại khỏi danh sách thay vì để Student gặp lỗi thô khi lưu (DEF_123)
    const suggested = useMemo(
        () => suggestedList.filter(s => (studentSpecId ? s.specializationId === studentSpecId : !!s.specializationId)),
        [suggestedList, studentSpecId]
    )
    const sugTotalPages = Math.ceil(suggested.length / SUGGESTED_PAGE_SIZE) || 1
    const pagedSuggested = useMemo(() => {
        const start = (sugPage - 1) * SUGGESTED_PAGE_SIZE
        return suggested.slice(start, start + SUGGESTED_PAGE_SIZE)
    }, [suggested, sugPage, SUGGESTED_PAGE_SIZE])

    const getVietnameseInitial = (name) => {
        if (!name) return '#'
        return name.trim().charAt(0).toUpperCase()
    }

    // Debounced skill options search/load using backend searchStudentSkillOptions
    useEffect(() => {
        const fetchSkills = async () => {
            try {
                let options
                if (query.trim() === '') {
                    options = await getStudentSkillOptions()
                    // Mẫu số của bộ đếm phải là toàn bộ danh mục, không phải kết quả tìm kiếm (DEF_120)
                    setTotalSkillOptions(options.length)
                } else {
                    options = await searchStudentSkillOptions(query.trim())
                }
                setAllSkills(options)
            } catch (err) {
                console.error("Failed to load/search skill options:", err)
            }
        }

        const delayDebounceFn = setTimeout(() => {
            fetchSkills()
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [query])

    // Reset page to 1 when query changes
    useEffect(() => {
        setPage(1)
    }, [query])

    const sortedSkills = useMemo(() => {
        let list = allSkills
        if (query.trim()) {
            const q = query.toLowerCase()
            list = list.filter(s => (s.name || '').toLowerCase().includes(q))
        }
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
    }, [allSkills, query])

    const totalPages = Math.ceil(sortedSkills.length / PAGE_SIZE) || 1

    const pagedSkills = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE
        return sortedSkills.slice(start, start + PAGE_SIZE)
    }, [sortedSkills, page, PAGE_SIZE])

    const skillColumns = useMemo(() => {
        if (!pagedSkills.length) return [[], [], []]
        const colSize = Math.ceil(pagedSkills.length / 3)
        return [
            pagedSkills.slice(0, colSize),
            pagedSkills.slice(colSize, colSize * 2),
            pagedSkills.slice(colSize * 2)
        ]
    }, [pagedSkills])

    const toggle = useCallback((id) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const isAllSkillsSelected = useMemo(() => {
        return allSkills.length > 0 && allSkills.every(s => selected.has(s.id))
    }, [allSkills, selected])

    const handleSelectAllSkills = useCallback(() => {
        setSelected(prev => {
            const next = new Set(prev)
            allSkills.forEach(s => next.add(s.id))
            return next
        })
    }, [allSkills])

    const handleClearAllSkills = useCallback(() => {
        setSelected(prev => {
            const next = new Set(prev)
            allSkills.forEach(s => next.delete(s.id))
            return next
        })
    }, [allSkills])

    const handleToggleAllSkills = useCallback(() => {
        setSelected(prev => {
            const next = new Set(prev)
            const allSelected = allSkills.length > 0 && allSkills.every(s => next.has(s.id))
            if (allSelected) {
                allSkills.forEach(s => next.delete(s.id))
            } else {
                allSkills.forEach(s => next.add(s.id))
            }
            return next
        })
    }, [allSkills])

    const isAllSuggestedSelected = useMemo(() => {
        return suggested.length > 0 && suggested.every(s => selected.has(s.id))
    }, [suggested, selected])

    const handleSelectAllSuggested = useCallback(() => {
        setSelected(prev => {
            const next = new Set(prev)
            suggested.forEach(s => next.add(s.id))
            return next
        })
    }, [suggested])

    const handleClearAllSuggested = useCallback(() => {
        setSelected(prev => {
            const next = new Set(prev)
            suggested.forEach(s => next.delete(s.id))
            return next
        })
    }, [suggested])

    const handleToggleAllSuggested = useCallback(() => {
        setSelected(prev => {
            const next = new Set(prev)
            if (isAllSuggestedSelected) {
                suggested.forEach(s => next.delete(s.id))
            } else {
                suggested.forEach(s => next.add(s.id))
            }
            return next
        })
    }, [isAllSuggestedSelected, suggested])

    const handleSave = useCallback(() => {
        setSaveState('saving')
        updateDeclaredSkills(Array.from(selected))
            .then(() => {
                setSaveState('saved')
                setToast({ message: 'Lưu danh sách kỹ năng thành công!', type: 'success' })
                refreshProfileFlow()
                // Backend loại kỹ năng đã khai báo khỏi gợi ý -> nạp lại để bỏ mục vừa lưu (DEF_121)
                loadSuggestions()
                setSugPage(1)
                setTimeout(() => setSaveState('idle'), 2500)
                setTimeout(() => setToast(null), 3500)
            })
            .catch(err => {
                console.error("Failed to save declared skills:", err)
                setSaveState('idle')
                const raw = err.response?.data?.message || ''
                // Lỗi kỹ thuật tiếng Anh của backend -> thông điệp thân thiện (DEF_123)
                const errMsg = /does not belong to student's specialization/i.test(raw)
                    ? 'Một số kỹ năng bạn chọn không thuộc chuyên ngành hiện tại nên không lưu được. Hãy tải lại trang và chọn lại.'
                    : /Skill not found/i.test(raw)
                        ? 'Một số kỹ năng bạn chọn không còn tồn tại trong hệ thống. Hãy tải lại trang và chọn lại.'
                        : raw || 'Lưu danh sách kỹ năng thất bại!'
                setToast({ message: errMsg, type: 'error' })
                setTimeout(() => setToast(null), 4000)
            })
    }, [selected, loadSuggestions])

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

            <div className="sk-page">
                <ProfileFlowFooter current="skills" />

                <div className="sk-head">
                    <h1 className="sk-title">
                        <span className="sk-title-icon"><Wrench size={20} strokeWidth={2.5} /></span>
                        Khai báo Kỹ năng
                    </h1>
                </div>

                {!profileIncomplete && !hasTranscript && !transcriptError && (
                    <ProfileFlowAlert
                        stepKey="transcript"
                        title="Chưa có bảng điểm (bước 2)"
                        message="Tải bảng điểm lên trước để hệ thống tự gợi ý kỹ năng từ những môn bạn đã hoàn thành — bạn vẫn có thể tự chọn thủ công ở dưới."
                        ctaLabel="Tải bảng điểm"
                    />
                )}

                {!profileIncomplete && transcriptError && (
                    <ProfileFlowAlert
                        stepKey="transcript"
                        title="Không kiểm tra được bảng điểm"
                        message={`${transcriptError} Đây là lỗi tải dữ liệu — nếu bạn đã từng tải bảng điểm lên thì dữ liệu vẫn còn nguyên. Hãy thử tải lại trang.`}
                        ctaLabel="Mở màn bảng điểm"
                    />
                )}

                {showImpactBanner && (
                    <div className="sk-impact-banner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span style={{ flex: 1 }}>
                            Kỹ năng bạn khai báo sẽ <strong>ảnh hưởng trực tiếp</strong> đến điểm phù hợp và thứ hạng gợi ý chuyên ngành hẹp.
                            Hãy chọn chính xác các kỹ năng bạn thực sự tự tin hoặc đã tích lũy!
                        </span>
                        <button
                            type="button"
                            className="sk-impact-banner-close"
                            onClick={() => setShowImpactBanner(false)}
                            aria-label="Đóng thông báo"
                            title="Đóng thông báo"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {suggested.length > 0 && (
                    <div className="sk-card sk-suggested-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <h2 className="sk-suggested-title" style={{ margin: 0 }}>Gợi ý từ bảng điểm môn học của bạn</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={handleToggleAllSuggested}
                                    disabled={profileIncomplete}
                                    style={{
                                        padding: '6px 14px',
                                        fontSize: '12.5px',
                                        fontWeight: '700',
                                        color: profileIncomplete ? '#94A3B8' : '#FFFFFF',
                                        background: profileIncomplete ? '#E2E8F0' : '#034EA2',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: profileIncomplete ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        boxShadow: profileIncomplete ? 'none' : '0 2px 6px rgba(3, 78, 162, 0.25)'
                                    }}
                                >
                                    {isAllSuggestedSelected ? <X size={14} /> : <CheckCheck size={14} />}
                                    {isAllSuggestedSelected ? 'Bỏ chọn tất cả gợi ý' : 'Chọn tất cả gợi ý'}
                                </button>
                            </div>
                        </div>
                        <p className="sk-suggested-desc">
                            Hệ thống tự động đề xuất kỹ năng dựa trên các môn bạn đã hoàn thành. Rê chuột vào kỹ năng để xem môn học tương ứng.
                        </p>
                        {profileIncomplete && (
                            <div style={{ padding: '8px 0' }}>
                                <ProfileIncompleteNotice />
                            </div>
                        )}
                        <div className="sk-pill-wrap">
                            {pagedSuggested.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className={`sk-pill sk-pill-suggested${selected.has(s.id) ? ' sk-pill-checked' : ''}`}
                                    onClick={() => toggle(s.id)}
                                    onMouseEnter={() => setHoveredSkillId(s.id)}
                                    onMouseLeave={() => setHoveredSkillId(null)}
                                    disabled={profileIncomplete}
                                >
                                    <span className={`sk-checkbox${selected.has(s.id) ? ' sk-checkbox-on' : ''}`} />
                                    {s.name}
                                </button>
                            ))}
                        </div>

                        {sugTotalPages > 1 && (
                            <div className="sk-pagination" style={{ marginTop: '14px', paddingTop: '12px' }}>
                                <button
                                    type="button"
                                    className="sk-page-btn"
                                    disabled={sugPage === 1}
                                    onClick={() => setSugPage(prev => Math.max(prev - 1, 1))}
                                >
                                    <ChevronLeft size={14} /> Trang trước
                                </button>
                                <span className="sk-page-info">
                                    Trang {sugPage} / {sugTotalPages}
                                </span>
                                <button
                                    type="button"
                                    className="sk-page-btn"
                                    disabled={sugPage === sugTotalPages}
                                    onClick={() => setSugPage(prev => Math.min(prev + 1, sugTotalPages))}
                                >
                                    Trang sau <ChevronRight size={14} />
                                </button>
                            </div>
                        )}

                        {(() => {
                            const hoveredSkillObj = suggested.find(s => s.id === hoveredSkillId);
                            const explanationText = hoveredSkillObj
                                ? (hoveredSkillObj.suggestedReason || (hoveredSkillObj.sourceCourseNames?.length > 0 ? `Do bạn đã hoàn thành môn: ${hoveredSkillObj.sourceCourseNames.join(', ')}` : `Gợi ý dựa trên môn học liên quan đã hoàn thành trong bảng điểm.`))
                                : "Kỹ năng được gợi ý dựa trên môn học liên quan đã hoàn thành.";
                            return (
                                <div className={`sk-suggest-explanation ${hoveredSkillId ? 'visible' : ''}`} style={{ marginTop: '12px' }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#F37021' }}>
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    <span className="sk-suggest-explanation-text">
                                        {explanationText}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                )}

                <div className="sk-card sk-list-card">
                    <div className="sk-list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <input
                            type="text"
                            className="sk-search"
                            placeholder="Tìm kỹ năng…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{ marginBottom: 0, maxWidth: '280px', width: '100%' }}
                            disabled={profileIncomplete}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleSelectAllSkills}
                                disabled={profileIncomplete || isAllSkillsSelected}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    color: (profileIncomplete || isAllSkillsSelected) ? '#94A3B8' : '#FFFFFF',
                                    background: (profileIncomplete || isAllSkillsSelected) ? '#E2E8F0' : '#034EA2',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: (profileIncomplete || isAllSkillsSelected) ? 'not-allowed' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    boxShadow: (profileIncomplete || isAllSkillsSelected) ? 'none' : '0 2px 6px rgba(3, 78, 162, 0.2)'
                                }}
                            >
                                <CheckCheck size={14} />
                                Chọn tất cả
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllSkills}
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
                        ) : sortedSkills.length === 0 ? (
                            <p className="sk-empty" style={{ width: '100%' }}>Không tìm thấy kỹ năng phù hợp.</p>
                        ) : (
                            <div className="sk-columns-container">
                                {skillColumns.map((col, idx) => (
                                    <div key={idx} className="sk-column-card">
                                        {col.map((s) => {
                                            const checked = selected.has(s.id)
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className={`sk-pill${checked ? ' sk-pill-checked' : ''}`}
                                                    onClick={() => toggle(s.id)}
                                                    disabled={profileIncomplete}
                                                >
                                                    <span className={`sk-checkbox${checked ? ' sk-checkbox-on' : ''}`} />
                                                    <span>{s.name}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="sk-pagination">
                            <button
                                type="button"
                                className="sk-page-btn"
                                disabled={page === 1}
                                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                            >
                                <ChevronLeft size={14} /> Trang trước
                            </button>
                            <span className="sk-page-info">
                                Trang {page} / {totalPages}
                            </span>
                            <button
                                type="button"
                                className="sk-page-btn"
                                disabled={page === totalPages}
                                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                Trang sau <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="sk-card sk-footer-bar">
                    <span className="sk-footer-text">
                        Đã chọn {selected.size} / {Math.max(totalSkillOptions, allSkills.length)} kỹ năng khả dụng
                        {query.trim() && ` · ${allSkills.length} kết quả khớp "${query.trim()}"`}
                    </span>
                    <div className="sk-footer-actions">
                        <button type="button" className="sk-btn-primary" onClick={handleSave} disabled={saveState === 'saving' || profileIncomplete} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Save size={15} />
                            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu lựa chọn'}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}