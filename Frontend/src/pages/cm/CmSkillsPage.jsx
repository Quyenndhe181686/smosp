import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Globe, X, Wrench, Award, Plus, Pencil, Save, XCircle, Search } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmCatalogFilter from '../../components/cm/CmCatalogFilter'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization, getSpecializationCourses, getNarrowSpecCourses } from '../../services/catalogService'
import {
    getSpecializationSkills,
    createSkill,
    updateSkill,
    updateSkillStatus,
    updateSkillAliases,
    updateSkillCourseMap
} from '../../services/skillService'
import { getCourses } from '../../services/courseService'
import { getTagMap } from '../../services/tagMapService'
import './CmSkillsPage.css'

const emptyForm = { name: '', isActive: true, targetMajorId: '', targetSpecId: '', targetNsId: '' }

const STATUS_FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'active', label: 'Đang dùng' },
    { key: 'inactive', label: 'Đã tắt' },
]

const STATUS_OPTIONS = [
    { value: 'active', label: 'Đang dùng', tone: 'green' },
    { value: 'inactive', label: 'Đã tắt', tone: 'gray' },
]

/* Chuẩn hoá tên gọi khác về dạng mảng chuỗi để render và lọc ổn định dù máy chủ
   trả chuỗi thuần hay object. */
function normalizeSkill(sk, extra = {}) {
    const rawAliases = Array.isArray(sk?.aliases) ? sk.aliases : []
    const normalizedAliases = rawAliases.map(a => typeof a === 'string' ? a : (a?.alias || a?.name || '')).filter(Boolean)
    return {
        ...sk,
        aliases: normalizedAliases,
        updatedAt: sk.updatedAt ? new Date(sk.updatedAt).toLocaleDateString('vi-VN') : '—',
        ...extra,
    }
}

export default function CmSkillsPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const targetMajorId = location.state?.targetMajorId || location.state?.majorId || ''
    const targetSpecId = location.state?.targetSpecId || location.state?.specId || ''
    const username = localStorage.getItem('username') || 'Content Manager'
    const { toasts, showToast, dismissToast } = useCmToast()

    const [majors, setMajors] = useState([])
    const [specializations, setSpecializations] = useState([])
    const [narrowSpecs, setNarrowSpecs] = useState([])
    const [majorId, setMajorId] = useState('')
    const [specId, setSpecId] = useState('')
    const [selectedNsId, setSelectedNsId] = useState('')
    const [nsSkillIds, setNsSkillIds] = useState(null)
    const [skills, setSkills] = useState([])
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [formMode, setFormMode] = useState('create') // 'create' | 'edit'
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [specCourses, setSpecCourses] = useState([])
    const [allCourses, setAllCourses] = useState([])
    const [selectedCourseIds, setSelectedCourseIds] = useState([])
    const [courseSearchQuery, setCourseSearchQuery] = useState('')
    const [viewAllCatalog, setViewAllCatalog] = useState(!targetMajorId && !targetSpecId)
    const [skillsLoading, setSkillsLoading] = useState(false)
    const [skillsError, setSkillsError] = useState(null)
    const prevFiltersRef = useRef(null)
    const isRestoringRef = useRef(false)
    const [allCatalogSpecs, setAllCatalogSpecs] = useState([])
    const [formSpecs, setFormSpecs] = useState([])
    const [formNarrowSpecs, setFormNarrowSpecs] = useState([])

    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const loadAllCatalogSkills = useCallback(async () => {
        try {
            setSkillsLoading(true)
            setSkillsError(null)
            const allMajorsData = await getMajors()
            const activeM = (allMajorsData || []).filter(m => m.isActive)
            const specsNested = await Promise.all(activeM.map(m => getSpecializationsByMajor(m.id).catch(() => [])))
            const flatSpecs = specsNested.flat().filter(s => s.isActive)
            const skillResults = await Promise.all(
                flatSpecs.map(s =>
                    getSpecializationSkills(s.id)
                        .then(list => (list || []).map(sk => normalizeSkill(sk, { specName: s.name, specializationId: s.id })))
                        .catch(() => [])
                )
            )
            setSkills(skillResults.flat())
        } catch (err) {
            console.error('Không tải được toàn bộ kỹ năng:', err)
            showToast('Không tải được danh sách kỹ năng toàn hệ thống', 'error')
        } finally {
            setSkillsLoading(false)
        }
    }, [showToast])

    useEffect(() => {
        getMajors()
            .then(async (data) => {
                const activeMajors = (data || []).filter(m => m.isActive)
                setMajors(activeMajors)

                const selectedMajor = (targetMajorId && activeMajors.some(m => m.id === targetMajorId))
                    ? targetMajorId
                    : ''
                setMajorId(selectedMajor)

                const specsNested = await Promise.all(
                    activeMajors.map(m => getSpecializationsByMajor(m.id).catch(() => []))
                )
                const flatSpecs = specsNested.flat().filter(s => s.isActive)
                setAllCatalogSpecs(flatSpecs)

                if (!selectedMajor && !targetSpecId) {
                    loadAllCatalogSkills()
                }
            })
            .catch(err => console.error('Không tải được danh sách ngành:', err))

        getCourses({ size: 1000 })
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.content || [])
                setAllCourses(list)
            })
            .catch(err => console.error('Không tải được toàn bộ môn học:', err))
    }, [targetMajorId, targetSpecId, loadAllCatalogSkills])

    const handleToggleViewAll = async () => {
        const nextState = !viewAllCatalog
        setViewAllCatalog(nextState)
        if (nextState) {
            // Nhớ bộ lọc đang dùng để khôi phục khi tắt chế độ xem toàn bộ (DEF_46)
            prevFiltersRef.current = { majorId, specId, selectedNsId }
            setMajorId('')
            setSpecId('')
            setSelectedNsId('')
            setNsSkillIds(null)
            setSpecializations([])
            setNarrowSpecs([])
            await loadAllCatalogSkills()
        } else {
            const prev = prevFiltersRef.current
            if (prev?.majorId) {
                isRestoringRef.current = true
                setMajorId(prev.majorId)
                setSpecId(prev.specId || '')
                setSelectedNsId(prev.selectedNsId || '')
            } else {
                await loadAllCatalogSkills()
            }
        }
    }

    const closeForm = useCallback(() => {
        setFormMode('create')
        setEditingId(null)
        setForm({ ...emptyForm, targetMajorId: majorId || '', targetSpecId: specId || '' })
        setSelectedCourseIds([])
        setCourseSearchQuery('')
    }, [majorId, specId])

    useEffect(() => {
        if (!majorId) {
            setSpecializations([])
            setSpecId('')
            return
        }
        getSpecializationsByMajor(majorId)
            .then(data => {
                const activeSpecs = (data || []).filter(s => s.isActive)
                setSpecializations(activeSpecs)

                let selectedSpec = ''
                if (isRestoringRef.current && prevFiltersRef.current?.specId && activeSpecs.some(s => s.id === prevFiltersRef.current.specId)) {
                    selectedSpec = prevFiltersRef.current.specId
                    isRestoringRef.current = false
                } else if (targetSpecId && activeSpecs.some(s => s.id === targetSpecId)) {
                    selectedSpec = targetSpecId
                }
                setSpecId(selectedSpec)

                if (!selectedSpec) {
                    // Tải kỹ năng của tất cả chuyên ngành trong ngành được chọn
                    setSkillsLoading(true)
                    Promise.all(
                        activeSpecs.map(s =>
                            getSpecializationSkills(s.id)
                                .then(list => (list || []).map(sk => normalizeSkill(sk, { specName: s.name, specializationId: s.id })))
                                .catch(() => [])
                        )
                    ).then(results => {
                        setSkills(results.flat())
                    }).finally(() => setSkillsLoading(false))
                }
            })
            .catch(err => console.error('Không tải được danh sách chuyên ngành:', err))
    }, [majorId, targetSpecId])

    useEffect(() => {
        if (!specId) {
            setNarrowSpecs([])
            setSelectedNsId('')
            setNsSkillIds(null)
            return
        }
        getNarrowSpecsBySpecialization(specId)
            .then(data => setNarrowSpecs(data || []))
            .catch(err => console.error('Không tải được danh sách chuyên ngành hẹp:', err))

        setSkillsLoading(true)
        setSkillsError(null)
        const specObj = specializations.find(s => s.id === specId) || allCatalogSpecs.find(s => s.id === specId)
        getSpecializationSkills(specId)
            .then(data => {
                setSkills((data || []).map(s => normalizeSkill(s, { specName: specObj?.name || '', specializationId: specId })))
                setSkillsError(null)
            })
            .catch(err => {
                console.error('Không tải được danh sách kỹ năng:', err)
                setSkills([])
                setSkillsError(err.response?.data?.message || 'Không tải được danh sách kỹ năng của chuyên ngành này.')
                showToast('Không tải được danh sách kỹ năng', 'error')
            })
            .finally(() => setSkillsLoading(false))

        getSpecializationCourses(specId)
            .then(data => setSpecCourses(data || []))
            .catch(err => console.error('Không tải được danh sách môn học:', err))
    }, [specId, specializations, allCatalogSpecs, showToast])

    /* Khi lọc theo chuyên ngành hẹp: chỉ giữ lại kỹ năng đã ánh xạ cho nó */
    useEffect(() => {
        if (!selectedNsId) return
        getTagMap(selectedNsId)
            .then(data => {
                const list = Array.isArray(data) ? data : (data.skillIds || data.skills || [])
                const sIds = list
                    .filter(entry => entry.sourceType === 'SKILL' || entry.skillId || entry.sourceId || typeof entry === 'string' || typeof entry === 'number')
                    .map(entry => typeof entry === 'object' ? (entry.sourceId || entry.skillId || entry.id) : entry)
                setNsSkillIds(new Set(sIds))
            })
            .catch(err => {
                console.error('Không tải được ánh xạ của chuyên ngành hẹp:', err)
                setNsSkillIds(null)
                showToast('Không tải được ánh xạ của chuyên ngành hẹp — bộ lọc theo CNH tạm thời không áp dụng', 'error')
            })
    }, [selectedNsId, showToast])

    const handleMajorChange = (value) => {
        setMajorId(value)
        setSpecId('')
        setSelectedNsId('')
        setSpecializations([])
        setNarrowSpecs([])
        setNsSkillIds(null)
        setCurrentPage(1)
        if (!value) {
            setViewAllCatalog(true)
            loadAllCatalogSkills()
        } else {
            setViewAllCatalog(false)
        }
    }

    const handleSpecChange = (value) => {
        setSpecId(value)
        setSelectedNsId('')
        setNarrowSpecs([])
        setNsSkillIds(null)
        setCurrentPage(1)
        if (!value) {
            if (majorId) {
                setSkillsLoading(true)
                Promise.all(
                    specializations.map(s =>
                        getSpecializationSkills(s.id)
                            .then(list => (list || []).map(sk => normalizeSkill(sk, { specName: s.name, specializationId: s.id })))
                            .catch(() => [])
                    )
                ).then(results => setSkills(results.flat()))
                .finally(() => setSkillsLoading(false))
            } else {
                setViewAllCatalog(true)
                loadAllCatalogSkills()
            }
        } else {
            setViewAllCatalog(false)
        }
    }

    const handleNsChange = (value) => {
        setSelectedNsId(value)
        setNsSkillIds(null)
        setCurrentPage(1)
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return skills.filter((s) => {
            if (statusFilter === 'active' && !s.isActive) return false
            if (statusFilter === 'inactive' && s.isActive) return false
            if (nsSkillIds !== null && !nsSkillIds.has(s.id)) return false
            if (!q) return true
            const nameMatch = s.name ? s.name.toLowerCase().includes(q) : false
            const aliasMatch = (s.aliases || []).some((a) => {
                const aliasStr = typeof a === 'string' ? a : (a?.alias || a?.name || '')
                return aliasStr.toLowerCase().includes(q)
            })
            return nameMatch || aliasMatch
        })
    }, [skills, query, statusFilter, nsSkillIds])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const paginatedSkills = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filtered.slice(start, start + pageSize)
    }, [filtered, currentPage, pageSize])

    // Phải so trùng trong ĐÚNG chuyên ngành đích của kỹ năng đang tạo/sửa
    const nameExists = useCallback((name, excludeId, targetSpecId) => {
        const n = name.trim().toLowerCase()
        return skills.some((s) => {
            if (s.id === excludeId) return false
            if (targetSpecId && s.specializationId !== targetSpecId) return false
            return s.name.trim().toLowerCase() === n
        })
    }, [skills])

    const openCreate = () => {
        const initialMajor = majorId || (majors[0]?.id || '')
        const initialSpec = specId || (allCatalogSpecs[0]?.id || '')
        setForm({ ...emptyForm, targetMajorId: initialMajor, targetSpecId: initialSpec })
        if (initialMajor) {
            getSpecializationsByMajor(initialMajor).then(data => {
                setFormSpecs((data || []).filter(s => s.isActive))
            }).catch(() => {})
        }
        setEditingId(null)
        setSelectedCourseIds([])
        setCourseSearchQuery('')
        setFormMode('create')
    }

    const openEdit = (skill) => {
        const itemSpec = allCatalogSpecs.find(s => s.id === skill.specializationId)
        let itemMajorId = majorId || ''
        if (itemSpec && !itemMajorId) {
            const parentMajor = majors.find(m => m.id === itemSpec.majorId)
            if (parentMajor) itemMajorId = parentMajor.id
        }
        if (itemMajorId) {
            getSpecializationsByMajor(itemMajorId).then(data => {
                setFormSpecs((data || []).filter(s => s.isActive))
            }).catch(() => {})
        }
        setForm({
            name: skill.name,
            isActive: skill.isActive !== false,
            targetMajorId: itemMajorId,
            targetSpecId: skill.specializationId || specId || '',
            targetNsId: '',
        })
        setSelectedCourseIds(
            (skill.courseIds || (skill.courses ? skill.courses.map(c => c.id || c.courseId) : []))
                .map(id => String(id).toLowerCase())
        )
        setEditingId(skill.id)
        setFormMode('edit')
    }

    /* UC-35 / UC-36 */
    const handleSubmit = async (e) => {
        e.preventDefault()
        const trimmed = form.name.trim()
        if (!trimmed) {
            showToast('Vui lòng nhập tên kỹ năng', 'warning')
            return
        }
        // Đổi Ngành trong form mà chưa chọn Chuyên ngành mới thì phải bắt chọn lại,
        // không được âm thầm dùng chuyên ngành đang xem (DEF_53)
        const majorChangedInForm = !!form.targetMajorId && form.targetMajorId !== majorId
        if (majorChangedInForm && !form.targetSpecId) {
            showToast('Bạn vừa đổi Ngành — hãy chọn Chuyên ngành cho kỹ năng này trước khi lưu', 'warning')
            return
        }
        const targetSpec = form.targetSpecId || specId
        if (!targetSpec) {
            showToast('Vui lòng chọn chuyên ngành cho kỹ năng này', 'warning')
            return
        }
        if (nameExists(trimmed, editingId, targetSpec)) {
            showToast('Tên kỹ năng đã tồn tại trong chuyên ngành đã chọn', 'warning')
            return
        }

        setSaving(true)
        try {
            let targetId = editingId
            let finalSkill

            if (formMode === 'create') {
                const newSkill = await createSkill({ specializationId: targetSpec, name: trimmed })
                targetId = newSkill.id
                finalSkill = newSkill
                if (form.isActive === false) {
                    await updateSkillStatus(newSkill.id, false)
                    finalSkill.isActive = false
                }
                const mapRes = await updateSkillCourseMap(targetId, selectedCourseIds)
                finalSkill.courses = mapRes.courses || []
                finalSkill.courseIds = selectedCourseIds
            } else {
                await updateSkill(editingId, { specializationId: targetSpec, name: trimmed })
                if (form.isActive !== undefined) {
                    await updateSkillStatus(editingId, Boolean(form.isActive))
                }
                const mapRes = await updateSkillCourseMap(targetId, selectedCourseIds)
                finalSkill = { id: editingId, specializationId: targetSpec, name: trimmed, courses: mapRes.courses || [], courseIds: selectedCourseIds }
            }

            const mappedSkill = {
                ...finalSkill,
                isActive: form.isActive !== false,
                updatedAt: new Date().toLocaleDateString('vi-VN')
            }

            if (formMode === 'create') {
                setSkills(prev => [mappedSkill, ...prev])
                showToast(`Đã tạo kỹ năng "${trimmed}"`)
            } else {
                setSkills(prev => prev.map(s => s.id === editingId ? { ...s, ...mappedSkill } : s))
                showToast(`Đã lưu thay đổi cho "${trimmed}"`)
            }
            closeForm()
        } catch (err) {
            console.error('Không lưu được kỹ năng:', err)
            showToast(err.response?.data?.message || 'Có lỗi xảy ra khi lưu kỹ năng', 'error')
        } finally {
            setSaving(false)
        }
    }

    /* UC-37 — đổi trạng thái trực tiếp trên bảng, luôn là tắt mềm (BR-09) */
    const handleStatusChange = async (skill, nextValue) => {
        const isActive = nextValue === 'active'
        try {
            await updateSkillStatus(skill.id, isActive)
            setSkills(prev => prev.map((s) => (s.id === skill.id ? { ...s, isActive } : s)))
            showToast(`Đã ${isActive ? 'bật lại' : 'tắt'} kỹ năng "${skill.name}"`, isActive ? 'success' : 'info')
        } catch (err) {
            console.error('Không đổi được trạng thái:', err)
            showToast('Không đổi được trạng thái kỹ năng', 'error')
        }
    }

    const handleFormMajorChange = async (mid) => {
        setForm(p => ({ ...p, targetMajorId: mid, targetSpecId: '', targetNsId: '' }))
        setFormNarrowSpecs([])
        if (!mid) {
            setFormSpecs([])
            return
        }
        const specsData = await getSpecializationsByMajor(mid).catch(() => [])
        setFormSpecs(specsData.filter(s => s.isActive))
    }

    const handleFormSpecChange = async (sid) => {
        setForm(p => ({ ...p, targetSpecId: sid, targetNsId: '' }))
        if (!sid) {
            setFormNarrowSpecs([])
            return
        }
        const [nsData, cData] = await Promise.all([
            getNarrowSpecsBySpecialization(sid).catch(() => []),
            getSpecializationCourses(sid).catch(() => []),
        ])
        setFormNarrowSpecs(nsData || [])
        setSpecCourses(cData || [])
    }

    const handleFormNsChange = async (nsId) => {
        setForm(p => ({ ...p, targetNsId: nsId }))
        if (nsId) {
            const nsCourses = await getNarrowSpecCourses(nsId).catch(() => [])
            if (nsCourses.length > 0) {
                setSpecCourses(prev => {
                    const existing = new Set(prev.map(c => c.courseId || c.id))
                    const newOnes = nsCourses.filter(c => !existing.has(c.courseId || c.id))
                    return [...prev, ...newOnes]
                })
            }
        }
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    const majorOptions = useMemo(
        () => [{ value: '', label: 'Chọn ngành học' }, ...majors.map(m => ({ value: m.id, label: m.name }))],
        [majors]
    )
    const formSpecOptions = useMemo(() => {
        const source = formSpecs.length > 0 ? formSpecs : allCatalogSpecs
        return [{ value: '', label: 'Chọn chuyên ngành' }, ...source.map(s => ({ value: s.id, label: s.name }))]
    }, [formSpecs, allCatalogSpecs])
    const formNsOptions = useMemo(
        () => [{ value: '', label: 'Không gắn chuyên ngành hẹp' }, ...formNarrowSpecs.map(ns => ({ value: ns.id, label: ns.name }))],
        [formNarrowSpecs]
    )

    /* Môn học khớp từ khoá và chưa được liên kết */
    const courseSuggestions = useMemo(() => {
        const q = courseSearchQuery.trim().toLowerCase()
        if (!q) return []
        const pool = allCourses.length > 0 ? allCourses : specCourses
        return pool.filter(c => {
            const cId = String(c.courseId || c.id).toLowerCase()
            if (selectedCourseIds.includes(cId)) return false
            const cCode = (c.courseCode || c.code || '').toLowerCase()
            const cName = (c.courseName || c.name || '').toLowerCase()
            return cCode.includes(q) || cName.includes(q)
        })
    }, [allCourses, specCourses, selectedCourseIds, courseSearchQuery])

    const activeCount = skills.filter(s => s.isActive).length

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="cs-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><Award size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Kỹ năng chuyên môn</h1>
                            <p className="cm-page-sub">
                                Kho kỹ năng theo từng chuyên ngành, dùng cho sinh viên khai báo và cho ma trận ánh xạ
                            </p>
                        </div>
                    </div>
                    <div className="cm-page-head-actions">
                        <span className="cm-tag cm-tag--green">{activeCount} đang dùng</span>
                        <span className="cm-tag cm-tag--neutral">{skills.length} tổng cộng</span>
                    </div>
                </header>

                <CmCatalogFilter
                    majors={majors}
                    selectedMajorId={majorId}
                    onMajorChange={handleMajorChange}
                    specs={specializations}
                    selectedSpecId={specId}
                    onSpecChange={handleSpecChange}
                    narrowSpecs={narrowSpecs}
                    selectedNsId={selectedNsId}
                    onNsChange={handleNsChange}
                />

                <div className="cs-layout">
                    <div className="cs-main">
                        <div className="cs-card cs-toolbar">
                            <div className="cs-search-box">
                                <Search size={14} strokeWidth={2.4} className="cs-search-icon" />
                                <input
                                    type="text"
                                    className="cs-search"
                                    placeholder="Tìm theo tên hoặc tên gọi khác..."
                                    value={query}
                                    onChange={(e) => { setQuery(e.target.value); setCurrentPage(1) }}
                                />
                            </div>

                            <div className="cs-filter-group">
                                {STATUS_FILTERS.map((f) => (
                                    <button
                                        key={f.key}
                                        type="button"
                                        className={`cs-chip${statusFilter === f.key ? ' is-active' : ''}`}
                                        onClick={() => { setStatusFilter(f.key); setCurrentPage(1) }}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                className={`cm-btn ${viewAllCatalog ? 'cm-btn--primary' : 'cm-btn--secondary'}`}
                                onClick={handleToggleViewAll}
                            >
                                <Globe size={14} strokeWidth={2.4} />
                                {viewAllCatalog ? 'Đang xem toàn bộ' : 'Xem toàn bộ danh mục'}
                            </button>

                            <button type="button" className="cm-btn cm-btn--primary" onClick={openCreate}>
                                <Plus size={15} strokeWidth={2.6} /> Thêm kỹ năng
                            </button>
                        </div>

                        <div className="cs-card cs-table-card">
                            <div className="cs-table-wrap">
                                <table className="cs-table">
                                    <thead>
                                        <tr>
                                            <th>Tên kỹ năng</th>
                                            <th>Trạng thái</th>
                                            <th>Cập nhật</th>
                                            <th className="cs-th-center" style={{ width: '100px' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedSkills.map((s) => {

                                            return (
                                                <tr key={s.id} className={!s.isActive ? 'cs-row-inactive' : ''}>
                                                    <td className="cs-name-cell">{s.name}</td>
                                                    <td>
                                                        <CmSelect
                                                            options={STATUS_OPTIONS}
                                                            value={s.isActive ? 'active' : 'inactive'}
                                                            onChange={(value) => handleStatusChange(s, value)}
                                                            size="sm"
                                                            tinted
                                                            searchable={false}
                                                            width="140px"
                                                        />
                                                    </td>
                                                    <td className="cs-muted">{s.updatedAt}</td>
                                                    <td className="cs-td-center">
                                                        <button
                                                            type="button"
                                                            className="cm-btn cm-btn--secondary cm-btn--sm"
                                                            onClick={() => openEdit(s)}
                                                            title={`Sửa kỹ năng "${s.name}"`}
                                                        >
                                                            <Pencil size={13} strokeWidth={2.4} /> Sửa
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {filtered.length === 0 && (
                                            <tr><td colSpan={4} className="cs-empty">
                                                {skillsLoading
                                                    ? 'Đang tải danh sách kỹ năng…'
                                                    : skillsError
                                                        ? `${skillsError} Đây là lỗi tải dữ liệu, không phải chuyên ngành chưa có kỹ năng.`
                                                        : 'Không tìm thấy kỹ năng nào phù hợp'}
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filtered.length > 0 && (
                                <CmPagination
                                    page={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                    totalItems={filtered.length}
                                    pageSize={pageSize}
                                    onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
                                    itemLabel="kỹ năng"
                                />
                            )}
                        </div>
                    </div>

                    {/* ── Biểu mẫu tạo / sửa ── */}
                    <aside className="cs-card cs-form-panel">
                        <form onSubmit={handleSubmit} className="cs-form">
                            <div className="cs-form-head">
                                <h2 className="cs-form-title">
                                    {formMode === 'create' ? 'Thêm kỹ năng mới' : 'Chỉnh sửa kỹ năng'}
                                </h2>
                                {formMode === 'edit' && (
                                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={closeForm}>
                                        <Plus size={13} strokeWidth={2.6} /> Thêm mới
                                    </button>
                                )}
                            </div>

                            <div className="cs-field">
                                <label className="cs-label" htmlFor="cs-name-input">
                                    Tên kỹ năng <span className="cs-required">*</span>
                                </label>
                                <input
                                    id="cs-name-input"
                                    type="text"
                                    className="cs-input"
                                    value={form.name}
                                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="Ví dụ: Spring Boot"
                                />
                            </div>

                            <div className="cs-field">
                                <span className="cs-label">Trạng thái</span>
                                <CmSelect
                                    options={STATUS_OPTIONS}
                                    value={form.isActive ? 'active' : 'inactive'}
                                    onChange={(value) => setForm(p => ({ ...p, isActive: value === 'active' }))}
                                    tinted
                                    searchable={false}
                                />
                            </div>

                            <div className="cs-field">
                                <span className="cs-label">Ngành học <span className="cs-required">*</span></span>
                                <CmSelect
                                    options={majorOptions}
                                    value={form.targetMajorId || ''}
                                    onChange={handleFormMajorChange}
                                    placeholder="Chọn ngành học"
                                />
                            </div>

                            <div className="cs-field">
                                <span className="cs-label">Chuyên ngành <span className="cs-required">*</span></span>
                                <CmSelect
                                    options={formSpecOptions}
                                    value={form.targetSpecId || ''}
                                    onChange={handleFormSpecChange}
                                    placeholder="Chọn chuyên ngành"
                                />
                            </div>

                            {formNarrowSpecs.length > 0 && (
                                <div className="cs-field">
                                    <span className="cs-label">Chuyên ngành hẹp (không bắt buộc)</span>
                                    <CmSelect
                                        options={formNsOptions}
                                        value={form.targetNsId || ''}
                                        onChange={handleFormNsChange}
                                        placeholder="Không gắn chuyên ngành hẹp"
                                    />
                                </div>
                            )}

                            {/* Course selection section */}
                            <div className="cs-divider" />
                            <div className="cs-field">
                                <span className="cs-label">Môn học liên kết ({selectedCourseIds.length})</span>
                                <p className="cs-hint">Tìm kiếm và chọn môn học để liên kết với kỹ năng này</p>
                                
                                <div className="cs-search-box" style={{ marginBottom: '8px' }}>
                                    <Search size={14} strokeWidth={2.4} className="cs-search-icon" />
                                    <input 
                                        type="text" 
                                        className="cs-search" 
                                        placeholder="Tìm theo mã hoặc tên môn..." 
                                        value={courseSearchQuery}
                                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                                    />
                                </div>

                                {courseSuggestions.length > 0 && (
                                    <div className="cs-course-suggestions">
                                        {courseSuggestions.map(c => (
                                            <div 
                                                key={c.courseId || c.id} 
                                                className="cs-course-suggestion-item"
                                                onClick={() => {
                                                    setSelectedCourseIds(prev => [...prev, String(c.courseId || c.id).toLowerCase()]);
                                                    setCourseSearchQuery('');
                                                }}
                                            >
                                                <Plus size={14} strokeWidth={2.4} className="cs-course-add-icon" />
                                                <span className="cs-course-code">{c.courseCode || c.code}</span>
                                                <span className="cs-course-name">{c.courseName || c.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="cs-selected-courses">
                                    {selectedCourseIds.length === 0 ? (
                                        <div className="cs-no-courses">Chưa chọn môn học liên kết nào</div>
                                    ) : (
                                        selectedCourseIds.map(cId => {
                                            const pool = allCourses.length > 0 ? allCourses : specCourses;
                                            const course = pool.find(c => String(c.courseId || c.id).toLowerCase() === cId);
                                            const code = course?.courseCode || course?.code || '???';
                                            const name = course?.courseName || course?.name || 'Môn học không xác định';
                                            return (
                                                <div key={cId} className="cs-selected-course-item">
                                                    <div>
                                                        <span className="cs-course-code">{code}</span>
                                                        <span className="cs-course-name">{name}</span>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        className="cs-remove-course-btn"
                                                        onClick={() => setSelectedCourseIds(prev => prev.filter(id => id !== cId))}
                                                    >
                                                        <X size={14} strokeWidth={2.4} />
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="cs-form-actions">
                                <button type="button" className="cm-btn cm-btn--secondary cs-btn-half" onClick={closeForm}>
                                    <XCircle size={14} strokeWidth={2.4} /> Hủy
                                </button>
                                <button type="submit" className="cm-btn cm-btn--primary cs-btn-half" disabled={saving}>
                                    <Save size={14} strokeWidth={2.4} />
                                    {saving ? 'Đang lưu...' : formMode === 'create' ? 'Tạo mới' : 'Lưu'}
                                </button>
                            </div>
                        </form>
                    </aside>
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}
