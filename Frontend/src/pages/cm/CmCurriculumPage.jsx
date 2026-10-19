import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmCatalogFilter from '../../components/cm/CmCatalogFilter'
import { X, ArrowRight, FlaskConical, Ban, Save, Plus, Layers, GripVertical } from 'lucide-react'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './CmCurriculumPage.css'
import {
    getMajors,
    getSpecializationsByMajor,
    getNarrowSpecsBySpecialization,
    getSpecializationCourses,
    updateSpecializationCourses,
    getNarrowSpecCourses,
    updateNarrowSpecCourses,
    getNarrowSpecExcludedCourses,
    updateNarrowSpecExcludedCourses
} from '../../services/catalogService'
import { getCourses } from '../../services/courseService'

export default function CmCurriculumPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const username = localStorage.getItem('username') || 'Content Manager'

    const navState = location.state || {}

    /* Mode: spec | ns */
    const [mode, setMode] = useState(navState.mode || 'spec')

    /* Dropdown Data */
    const [majors, setMajors] = useState([])
    const [specs, setSpecs] = useState([])
    const [narrowSpecs, setNarrowSpecs] = useState([])
    const [allCourses, setAllCourses] = useState([])

    /*
      FIX duplicate payload: allCourses được giữ trong ref để loadMapping effect
      KHÔNG cần allCourses trong dependency array.
      Nếu để allCourses trong deps, mỗi lần setAllCourses tạo reference mới
      → effect chạy lại → setTermMap(grouped) overwrite termMap đang có
      → user vừa add môn xong bị reset, hoặc race condition tạo duplicate entries.
    */
    const allCoursesRef = useRef([])

    /* Context selectors */
    const [selectedMajorId, setSelectedMajorId] = useState(navState.majorId || '')
    const [selectedSpecId, setSelectedSpecId] = useState(navState.specId || '')
    const [selectedNsId, setSelectedNsId] = useState(navState.nsId || '')

    /* Course mapping */
    const [termMap, setTermMap] = useState({})
    const [loading, setLoading] = useState(false)
    const [parentSpecCourses, setParentSpecCourses] = useState([])
    const [parentSpecCourseIds, setParentSpecCourseIds] = useState(new Set())
    const [excludedCourses, setExcludedCourses] = useState([])

    /*
      FIX drag: dùng draggingRef (useRef) thay vì state để lưu payload kéo.
      setDragging() trigger re-render → React remount DOM → browser mất drag session.
      isDragging (useState) chỉ dùng để apply CSS, set 1 lần tại start/end.
    */
    const draggingRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const [dragOverTerm, setDragOverTerm] = useState(null)

    /* Add-to-term popup */
    const [addPopup, setAddPopup] = useState(null)
    const [addSearch, setAddSearch] = useState('')

    /* Add Exclude Course popup */
    const [addExcludePopup, setAddExcludePopup] = useState(false)
    const [excludeNote, setExcludeNote] = useState('')
    const [excludeSearch, setExcludeSearch] = useState('')

    /* Thông báo — dùng chung, hiện ở góc phải trên */
    const { toasts, showToast, dismissToast } = useCmToast()

    /* Load initial majors & courses (leave filter empty unless navState passed) */
    useEffect(() => {
        const initLoad = async () => {
            try {
                const majorsData = await getMajors()
                setMajors(majorsData.filter(m => m.isActive))

                const coursesData = await getCourses({ size: 1000 })
                const courses = coursesData.content || []
                setAllCourses(courses)
                allCoursesRef.current = courses

                if (navState.majorId) {
                    setSelectedMajorId(navState.majorId)
                } else {
                    setSelectedMajorId('')
                }
            } catch (err) {
                console.error('Failed to load initial catalog:', err)
                showToast('Lỗi khi tải danh mục gốc', 'error')
            }
        }
        initLoad()
    }, [])

    /* Tải chuyên ngành khi đổi ngành.
       Việc dọn state cấp dưới đã do handleMajorChange lo — effect chỉ tải dữ liệu. */
    useEffect(() => {
        if (!selectedMajorId) return
        const loadSpecs = async () => {
            try {
                const specsData = await getSpecializationsByMajor(selectedMajorId)
                const activeSpecs = specsData.filter(s => s.isActive)
                setSpecs(activeSpecs)

                if (navState.majorId === selectedMajorId && navState.specId) {
                    setSelectedSpecId(navState.specId)
                } else {
                    setSelectedSpecId('')
                    setNarrowSpecs([])
                    setSelectedNsId('')
                    setMode('spec')
                }
            } catch (err) {
                console.error('Failed to load specializations:', err)
                showToast('Lỗi khi tải chuyên ngành', 'error')
            }
        }
        loadSpecs()
    }, [selectedMajorId])

    /* Load Parent Spec Courses for NS add-popup filtering & Exclude list */
    useEffect(() => {
        if (!selectedSpecId) return
        const loadParentCourses = async () => {
            try {
                const data = await getSpecializationCourses(selectedSpecId)
                setParentSpecCourses(data)
                setParentSpecCourseIds(new Set(data.map(item => item.courseId)))
            } catch (err) {
                console.error('Failed to load parent spec courses:', err)
            }
        }
        loadParentCourses()
    }, [selectedSpecId])

    /* Load Narrow Specializations when selectedSpecId changes */
    useEffect(() => {
        if (!selectedSpecId) return
        const loadNS = async () => {
            try {
                const nsData = await getNarrowSpecsBySpecialization(selectedSpecId)
                setNarrowSpecs(nsData)

                if (navState.specId === selectedSpecId && navState.nsId) {
                    setSelectedNsId(navState.nsId)
                    setMode('ns')
                } else {
                    setSelectedNsId('')
                    setMode('spec')
                }
            } catch (err) {
                console.error('Failed to load narrow specializations:', err)
                showToast('Lỗi khi tải chuyên ngành hẹp', 'error')
            }
        }
        loadNS()
    }, [selectedSpecId])

    /*
      Load mapping khi mode/specId/nsId thay đổi.
      FIX: allCourses KHÔNG có trong deps — dùng allCoursesRef.current để lookup credits.
      Nếu để allCourses trong deps: mỗi lần initLoad chạy xong và setAllCourses()
      tạo reference mới → effect này chạy lại → setTermMap(grouped) overwrite
      termMap hiện tại → mất môn user vừa add, hoặc tạo duplicate khi race condition.
    */
    useEffect(() => {
        const loadMapping = async () => {
            if (mode === 'spec' && selectedSpecId) {
                try {
                    setLoading(true)
                    const data = await getSpecializationCourses(selectedSpecId)
                    const courseLookup = {}
                    allCoursesRef.current.forEach(c => { courseLookup[c.id] = c })

                    const grouped = {}
                    data.forEach(item => {
                        const term = item.termOrder
                        if (!grouped[term]) grouped[term] = []
                        grouped[term].push({
                            id: item.courseId,
                            code: item.courseCode,
                            name: item.courseName,
                            credits: courseLookup[item.courseId]?.credits || 0,
                            courseType: item.courseType || 'CORE'
                        })
                    })
                    setTermMap(grouped)
                } catch (err) {
                    console.error('Failed to load spec mapping:', err)
                    showToast('Lỗi khi tải chương trình học của chuyên ngành', 'error')
                } finally {
                    setLoading(false)
                }
            } else if (mode === 'ns' && selectedNsId) {
                try {
                    setLoading(true)
                    const data = await getNarrowSpecCourses(selectedNsId)
                    const courseLookup = {}
                    allCoursesRef.current.forEach(c => { courseLookup[c.id] = c })

                    const grouped = {}
                    data.forEach(item => {
                        const term = item.termOrder
                        if (!grouped[term]) grouped[term] = []
                        grouped[term].push({
                            id: item.courseId,
                            code: item.courseCode,
                            name: item.courseName,
                            credits: courseLookup[item.courseId]?.credits || 0
                        })
                    })
                    setTermMap(grouped)

                    // Fetch excluded courses
                    const exData = await getNarrowSpecExcludedCourses(selectedNsId)
                    setExcludedCourses(exData.map(item => ({
                        courseId: item.course.id,
                        code: item.course.code,
                        name: item.course.name,
                        note: item.note || ''
                    })))
                } catch (err) {
                    console.error('Failed to load ns mapping:', err)
                    showToast('Lỗi khi tải chương trình học của chuyên ngành hẹp', 'error')
                } finally {
                    setLoading(false)
                }
            } else {
                setTermMap({})
                setExcludedCourses([])
            }
        }

        // Chỉ load khi ref đã có data (tức initLoad đã chạy xong)
        if (allCoursesRef.current.length > 0) {
            loadMapping()
        }
    }, [mode, selectedSpecId, selectedNsId]) // ← allCourses KHÔNG có ở đây

    /* Handle major change */
    function handleMajorChange(mid) {
        setSelectedMajorId(mid)
        setSpecs([])
        setNarrowSpecs([])
        setSelectedSpecId('')
        setSelectedNsId('')
        setMode('spec')
        setTermMap({})
        setParentSpecCourseIds(new Set())
    }

    function handleSpecChange(sid) {
        setSelectedSpecId(sid)
        setNarrowSpecs([])
        setSelectedNsId('')
        setMode('spec')
        setTermMap({})
        setParentSpecCourseIds(new Set())
    }

    const termRange = mode === 'spec' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [5, 7, 8]

    /* Add course to term */
    function handleAddToTerm(course) {
        const already = Object.values(termMap).some(arr => arr.some(c => c.id === course.id))
        if (already) {
            showToast('Môn này đã được gán vào kỳ khác trong cùng chuyên ngành', 'error')
            return
        }

        const courseEntry = {
            id: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits,
            courseType: 'CORE'
        }

        const term = addPopup.term
        setTermMap(prev => ({
            ...prev,
            [term]: [...(prev[term] || []), courseEntry]
        }))

        showToast(`Đã gán ${course.code} vào Kỳ ${term}`)
        setAddPopup(null)
        setAddSearch('')
    }

    /* Remove course from term */
    function removeFromTerm(term, courseId) {
        setTermMap(prev => ({
            ...prev,
            [term]: (prev[term] || []).filter(c => c.id !== courseId)
        }))
        showToast('Đã gỡ môn khỏi kỳ')
    }

    /* ── Drag & drop ── */
    const [draggingState, setDraggingState] = useState(null)

    function handleDragStart(e, fromTerm, course) {
        const item = { fromTerm, course }
        draggingRef.current = item
        setDraggingState(item)
        setIsDragging(true)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(course.id))
        const row = e.currentTarget
        const rect = row.getBoundingClientRect()
        e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top)
    }

    function handleDragEnd() {
        draggingRef.current = null
        setDraggingState(null)
        setIsDragging(false)
        setDragOverTerm(null)
    }

    function handleDragOver(e, term) {
        if (!draggingRef.current) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragOverTerm !== term) setDragOverTerm(term)
    }

    function handleDrop(e, toTerm) {
        e.preventDefault()
        const dragging = draggingRef.current
        if (!dragging) return
        draggingRef.current = null
        setDraggingState(null)
        setIsDragging(false)
        setDragOverTerm(null)

        if (Number(dragging.fromTerm) === Number(toTerm)) return

        setTermMap(prev => ({
            ...prev,
            [dragging.fromTerm]: (prev[dragging.fromTerm] || []).filter(c => c.id !== dragging.course.id),
            [toTerm]: [...(prev[toTerm] || []), dragging.course],
        }))
        showToast(`Đã chuyển ${dragging.course.code} từ Kỳ ${dragging.fromTerm} sang Kỳ ${toTerm}`)
    }

    /* Save mapping to backend */
    async function saveConfig() {
        if (!window.confirm("Lưu thay đổi chương trình đào tạo chuẩn có thể ảnh hưởng đến lộ trình của sinh viên. Bạn có chắc chắn muốn tiếp tục?")) {
            return;
        }
        try {
            if (mode === 'spec') {
                if (!selectedSpecId) return
                const payload = []
                Object.entries(termMap).forEach(([term, list]) => {
                    list.forEach(c => {
                        payload.push({ courseId: c.id, termOrder: Number(term), courseType: c.courseType || 'CORE' })
                    })
                })
                await updateSpecializationCourses(selectedSpecId, payload)
                showToast('Đã lưu cấu hình curriculum chuyên ngành thành công!')
            } else {
                if (!selectedNsId) return
                const payload = []
                Object.entries(termMap).forEach(([term, list]) => {
                    list.forEach(c => {
                        payload.push({ courseId: c.id, termOrder: Number(term) })
                    })
                })
                await updateNarrowSpecCourses(selectedNsId, payload)

                // Save excluded courses
                const exPayload = excludedCourses.map(item => ({
                    courseId: item.courseId,
                    note: item.note
                }))
                await updateNarrowSpecExcludedCourses(selectedNsId, exPayload)

                showToast('Đã lưu cấu hình chuyên ngành hẹp và danh sách môn loại trừ thành công!')
            }
        } catch (err) {
            console.error('Failed to save config:', err)
            showToast('Lỗi khi lưu cấu hình: ' + (err.response?.data?.message || err.message), 'error')
        }
    }

    /* Available courses for add popup */
    const assignedIds = new Set(Object.values(termMap).flat().map(c => c.id))
    const availForAdd = addSearch.trim()
        ? allCourses.filter(c =>
            c.isActive &&
            !assignedIds.has(c.id) &&
            (mode !== 'ns' || !parentSpecCourseIds.has(c.id)) &&
            (c.code.toLowerCase().includes(addSearch.toLowerCase()) ||
                c.name.toLowerCase().includes(addSearch.toLowerCase()))
        )
        : []

    /* Available courses for exclude popup */
    const availForExclude = excludeSearch.trim()
        ? parentSpecCourses.filter(c =>
            !excludedCourses.some(x => x.courseId === c.courseId) &&
            (c.courseCode.toLowerCase().includes(excludeSearch.toLowerCase()) ||
                c.courseName.toLowerCase().includes(excludeSearch.toLowerCase()))
        )
        : []

    /* Stats */
    const totalCourses = Object.values(termMap).flat().length
    const totalCredits = Object.values(termMap).flat().reduce((s, c) => s + c.credits, 0)
    const configuredTerms = termRange.filter(t => (termMap[t] || []).length > 0).length

    const handleLogout = async () => { await logout(); navigate('/login') }

    const selectedSpec = specs.find(s => s.id === selectedSpecId)
    const selectedNs = narrowSpecs.find(n => n.id === selectedNsId)
    const currentLabel = mode === 'spec' ? selectedSpec?.name : selectedNs?.name

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="curr-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><Layers size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Khung chương trình đào tạo</h1>
                            <p className="cm-page-sub">
                                Sắp xếp môn học theo từng kỳ và khai báo môn loại trừ cho chuyên ngành hẹp
                            </p>
                        </div>
                    </div>
                </header>

                {/* Add Exclude Course Popup */}
                {addExcludePopup && (
                    <div className="curr-overlay" onClick={() => { setAddExcludePopup(false); setExcludeNote(''); setExcludeSearch('') }}>
                        <div className="curr-popup" onClick={e => e.stopPropagation()}>
                            <div className="curr-popup-header">
                                <div>
                                    <div className="curr-popup-eyebrow">Loại trừ môn học</div>
                                    <div className="curr-popup-title">Thêm môn loại trừ</div>
                                </div>
                                <button className="curr-popup-close" onClick={() => { setAddExcludePopup(false); setExcludeNote(''); setExcludeSearch('') }} type="button" aria-label="Đóng"><X size={15} strokeWidth={2.6} /></button>
                            </div>

                            <div className="curr-popup-fields">
                                <div className="curr-popup-field">
                                    <label className="curr-popup-label" htmlFor="curr-exclude-note">
                                        Lý do loại trừ (không bắt buộc)
                                    </label>
                                    <input
                                        id="curr-exclude-note"
                                        className="curr-popup-search curr-popup-search--inline"
                                        placeholder="Ví dụ: môn này đã được thay thế bằng môn chuyên sâu"
                                        value={excludeNote}
                                        onChange={e => setExcludeNote(e.target.value)}
                                    />
                                </div>

                                <div className="curr-popup-field">
                                    <label className="curr-popup-label" htmlFor="curr-exclude-search">
                                        Tìm môn của chuyên ngành gốc
                                    </label>
                                    <input
                                        id="curr-exclude-search"
                                        className="curr-popup-search curr-popup-search--inline"
                                        placeholder="Tìm theo mã hoặc tên môn học..."
                                        value={excludeSearch}
                                        onChange={e => setExcludeSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="curr-popup-list">
                                {availForExclude.length === 0
                                    ? (
                                        <div className="curr-popup-empty">
                                            {!excludeSearch.trim()
                                                ? 'Nhập mã hoặc tên môn để tìm môn loại trừ'
                                                : 'Không tìm thấy môn học phù hợp'
                                            }
                                        </div>
                                    )
                                    : availForExclude.slice(0, 12).map(c => (
                                        <div
                                            key={c.courseId}
                                            className="curr-popup-item curr-popup-item--exclude"
                                            onClick={() => {
                                                setExcludedCourses(prev => [...prev, {
                                                    courseId: c.courseId,
                                                    code: c.courseCode,
                                                    name: c.courseName,
                                                    note: excludeNote
                                                }])
                                                showToast(`Đã thêm môn ${c.courseCode} vào danh sách loại trừ`)
                                                setAddExcludePopup(false)
                                                setExcludeNote('')
                                                setExcludeSearch('')
                                            }}
                                        >
                                            <div className="curr-popup-item-info">
                                                <span className="curr-popup-item-code">{c.courseCode}</span>
                                                <span className="curr-popup-item-name">{c.courseName}</span>
                                            </div>
                                            <span className="curr-popup-item-credits">{c.credits ?? 3}tc</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Add-course popup */}
                {addPopup && (
                    <div className="curr-overlay" onClick={() => { setAddPopup(null); setAddSearch('') }}>
                        <div className="curr-popup" onClick={e => e.stopPropagation()}>
                            <div className="curr-popup-header">
                                <div>
                                    <div className="curr-popup-eyebrow">Gán môn học vào</div>
                                    <div className="curr-popup-title">Kỳ {addPopup.term}</div>
                                </div>
                                <button className="curr-popup-close" onClick={() => { setAddPopup(null); setAddSearch('') }} type="button" aria-label="Đóng"><X size={15} strokeWidth={2.6} /></button>
                            </div>

                            <input
                                className="curr-popup-search"
                                placeholder="Tìm theo mã hoặc tên môn..."
                                value={addSearch}
                                onChange={e => setAddSearch(e.target.value)}
                                autoFocus
                            />

                            <div className="curr-popup-list">
                                {availForAdd.length === 0
                                    ? (
                                        <div className="curr-popup-empty">
                                            {!addSearch.trim()
                                                ? 'Nhập mã hoặc tên môn học để gán vào kỳ'
                                                : 'Không có môn nào phù hợp hoặc tất cả đã được gán'
                                            }
                                        </div>
                                    )
                                    : availForAdd.slice(0, 12).map(c => (
                                        <div key={c.id} className="curr-popup-item" onClick={() => handleAddToTerm(c)}>
                                            <div className="curr-popup-item-info">
                                                <span className="curr-popup-item-code">{c.code}</span>
                                                <span className="curr-popup-item-name">{c.name}</span>
                                            </div>
                                            <span className="curr-popup-item-credits">{c.credits}tc</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                )}

                <CmCatalogFilter
                    majors={majors}
                    selectedMajorId={selectedMajorId}
                    onMajorChange={(val) => handleMajorChange(val)}
                    specs={specs}
                    selectedSpecId={selectedSpecId}
                    onSpecChange={(val) => handleSpecChange(val)}
                    narrowSpecs={narrowSpecs}
                    selectedNsId={selectedNsId}
                    onNsChange={(val) => {
                        setSelectedNsId(val)
                        setMode(val ? 'ns' : 'spec')
                    }}
                />

                <div className="curr-wrap">
                    {/* ══ LEFT SIDEBAR ══ */}
                    <div className="curr-sidebar">

                        <div className="curr-stats">
                            <div className="curr-stat-row">
                                <span className="curr-stat-label">Kỳ đã cấu hình</span>
                                <span className="curr-stat-val blue">{configuredTerms} / {termRange.length}</span>
                            </div>
                            <div className="curr-stat-row">
                                <span className="curr-stat-label">Tổng số môn</span>
                                <span className="curr-stat-val">{totalCourses} môn</span>
                            </div>
                            <div className="curr-stat-row">
                                <span className="curr-stat-label">Tổng tín chỉ</span>
                                <span className="curr-stat-val">{totalCredits} tc</span>
                            </div>
                        </div>

                        <p className="curr-dnd-hint">
                            Mẹo: kéo thả một môn học sang kỳ khác để chuyển kỳ nhanh
                        </p>
                    </div>

                    {/* ══ MAIN ══ */}
                    <div className="curr-main">
                        <div className="curr-main-header">
                            <div>
                                <div className="curr-main-eyebrow">
                                    {mode === 'spec' ? 'Chuyên ngành · kỳ 1–9' : 'Chuyên ngành hẹp · kỳ 5–9'}
                                </div>
                                <div className="curr-main-title">{currentLabel || 'Chưa chọn chuyên ngành'}</div>
                            </div>
                            <button className="cm-btn cm-btn--primary" onClick={saveConfig} type="button">
                                <Save size={14} strokeWidth={2.4} /> Lưu cấu hình
                            </button>
                        </div>

                        <div className="curr-term-scroll">
                            {loading && <div className="curr-ns-empty">Đang tải chương trình học...</div>}

                            {!loading && narrowSpecs.length === 0 && mode === 'ns' && (
                                <div className="curr-ns-empty">
                                    <div className="curr-ns-empty-icon"><FlaskConical size={40} strokeWidth={1.4} /></div>
                                    <div>Chuyên ngành <strong>{selectedSpec?.name}</strong> chưa có chuyên ngành hẹp nào</div>
                                    <button className="cm-btn cm-btn--secondary" onClick={() => navigate('/cm/catalog')} type="button">
                                        Tạo chuyên ngành hẹp <ArrowRight size={13} strokeWidth={2.6} />
                                    </button>
                                </div>
                            )}

                            {!loading && (narrowSpecs.length > 0 || mode === 'spec') && (
                                <div className="curr-terms">
                                    {mode === 'ns' && (
                                        <div className="curr-term-card curr-term-card--excluded">
                                            <div className="curr-term-head">
                                                <div className="curr-term-num">
                                                    <Ban size={14} strokeWidth={2.4} /> Môn học loại trừ
                                                </div>
                                                <span className="cm-tag cm-tag--red">
                                                    {excludedCourses.length} môn bị loại trừ
                                                </span>
                                            </div>

                                            <div className="curr-course-list">
                                                {excludedCourses.length === 0 ? (
                                                    <div className="curr-course-empty">
                                                        Không loại trừ môn học nào từ chuyên ngành gốc
                                                    </div>
                                                ) : (
                                                    excludedCourses.map(c => (
                                                        <div key={c.courseId} className="curr-course-row">
                                                            <div className="curr-course-row-left">
                                                                <span className="curr-course-code">{c.code}</span>
                                                                <span className="curr-course-name">{c.name}</span>
                                                                {c.note && <span className="curr-course-note">({c.note})</span>}
                                                            </div>
                                                            <div className="curr-course-row-right">
                                                                <button
                                                                    className="curr-course-remove"
                                                                    onClick={() => {
                                                                        setExcludedCourses(prev => prev.filter(x => x.courseId !== c.courseId))
                                                                        showToast(`Đã gỡ môn ${c.code} khỏi danh sách loại trừ`)
                                                                    }}
                                                                    title="Không loại trừ môn này nữa"
                                                                    type="button"
                                                                ><X size={13} strokeWidth={3} /></button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <button
                                                className="curr-add-term-btn"
                                                onClick={() => setAddExcludePopup(true)}
                                                type="button"
                                            >
                                                <Plus size={14} strokeWidth={2.6} /> Thêm môn học loại trừ
                                            </button>
                                        </div>
                                    )}
                                    {termRange.map(term => {
                                        const termCourses = termMap[term] || []
                                        const isDropTarget = isDragging
                                            && dragOverTerm === term
                                            && Number(draggingState?.fromTerm) !== Number(term)

                                        return (
                                            <div
                                                key={term}
                                                className={`curr-term-card${isDropTarget ? ' curr-term-card--dragover' : ''}`}
                                                onDragOver={e => handleDragOver(e, term)}
                                                onDragLeave={() => { if (dragOverTerm === term) setDragOverTerm(null) }}
                                                onDrop={e => handleDrop(e, term)}
                                            >
                                                <div className="curr-term-head">
                                                    <div className="curr-term-num">Kỳ {term}</div>
                                                    <span className="curr-term-count">{termCourses.length} môn</span>
                                                </div>

                                                <div className="curr-course-list">
                                                    {termCourses.length === 0 ? (
                                                        <div className={`curr-course-empty${isDropTarget ? ' curr-course-empty--dragover' : ''}`}>
                                                            {isDragging ? 'Thả môn vào đây' : 'Chưa có môn nào trong kỳ này'}
                                                        </div>
                                                    ) : termCourses.map(c => (
                                                        <div
                                                            key={c.id}
                                                            className={`curr-course-row${isDragging && draggingState?.course?.id === c.id ? ' curr-course-row--dragging' : ''}`}
                                                            draggable
                                                            onDragStart={e => handleDragStart(e, term, c)}
                                                            onDragEnd={handleDragEnd}
                                                        >
                                                            <div className="curr-course-row-left">
                                                                <span className="curr-drag-handle" title="Kéo để chuyển sang kỳ khác">
                                                                    <GripVertical size={14} strokeWidth={2.2} />
                                                                </span>
                                                                <span className="curr-course-code">{c.code}</span>
                                                                <span className="curr-course-name">{c.name}</span>
                                                            </div>
                                                            <div className="curr-course-row-right">
                                                                {mode === 'spec' && (
                                                                    <select
                                                                        className="course-input"
                                                                        style={{ width: '80px', padding: '0 4px', fontSize: '11px', height: '24px', marginRight: '6px' }}
                                                                        value={c.courseType || 'CORE'}
                                                                        onChange={(e) => {
                                                                            setTermMap(prev => ({
                                                                                ...prev,
                                                                                [term]: prev[term].map(item => item.id === c.id ? { ...item, courseType: e.target.value } : item)
                                                                            }))
                                                                        }}
                                                                    >
                                                                        <option value="CORE">CORE</option>
                                                                        <option value="GENERAL">GENERAL</option>
                                                                    </select>
                                                                )}
                                                                <span className="curr-course-credits">{c.credits}tc</span>
                                                                <button
                                                                    className="curr-course-remove"
                                                                    onClick={() => removeFromTerm(term, c.id)}
                                                                    title="Gỡ môn khỏi kỳ"
                                                                    type="button"
                                                                ><X size={13} strokeWidth={3} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    className={`curr-add-term-btn${isDragging ? ' curr-add-term-btn--no-pointer' : ''}`}
                                                    onClick={() => { if (!isDragging) { setAddPopup({ term }); setAddSearch('') } }}
                                                    type="button"
                                                >
                                                    <Plus size={14} strokeWidth={2.6} /> Gán môn vào kỳ {term}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}