import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmCatalogFilter from '../../components/cm/CmCatalogFilter'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import {
    BookOpen, Check, XCircle, X, Plus, Pencil,
    Link2, AlertTriangle, Save, Upload, Trash2, Search
} from 'lucide-react'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './CmCoursePage.css'
import {
    getCourses,
    getCourseDetail,
    createCourse,
    updateCourse,
    deleteCourse,
    updatePrerequisites,
    uploadResource,
    deleteResource,
    updateResource,
    updateResourceOrder,
    searchCourseOptions
} from '../../services/courseService'
import {
    getMajors,
    getSpecializationsByMajor,
    getNarrowSpecsBySpecialization,
    getSpecializationCourses,
    getNarrowSpecCourses
} from '../../services/catalogService'
import { getSpecializationSkills, updateSkillCourseMap, createSkill } from '../../services/skillService'

const RESOURCE_TYPES = ['LINK', 'ARTICLE', 'DOCS', 'EXERCISE']

/* ── Panel modes ── */
const PANEL = {
    EMPTY: 'EMPTY',
    VIEW: 'VIEW',
    ADD: 'ADD',
    PREREQ: 'PREREQ',
    SKILL: 'SKILL',
}

export default function CmCoursePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const username = localStorage.getItem('username') || 'Content Manager'

    /* Data */
    const [courses, setCourses] = useState([])
    const [totalElements, setTotalElements] = useState(0)
    const [loading, setLoading] = useState(true)

    /* Selection */
    const [selectedCourse, setSelectedCourse] = useState(null)
    const [panel, setPanel] = useState(PANEL.EMPTY)

    /* Filters */
    const [searchInput, setSearchInput] = useState(location.state?.search || '')
    const [search, setSearch] = useState(location.state?.search || '')

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput)
            setPage(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput])
    // Toolbar theo đặc tả phải có bộ lọc Trạng thái và GPA (countsTowardGpa) — DEF_70
    const [filterStatus, setFilterStatus] = useState('')
    const [filterGpa, setFilterGpa] = useState('')
    const [page, setPage] = useState(1)
    const itemsPerPage = 10

    /* Form */
    const [form, setForm] = useState({ code: '', name: '', credits: 3, countsTowardGpa: true, description: '' })
    const [formErrors, setFormErrors] = useState({})

    /* Prereq panel */
    const [prereqSearch, setPrereqSearch] = useState('')
    const [prereqSearchResults, setPrereqSearchResults] = useState([])
    const [pendingPrereqs, setPendingPrereqs] = useState([])
    const [prereqTarget, setPrereqTarget] = useState(null)

    const handleSearchPrereq = async () => {
        if (prereqSearch.trim()) {
            try {
                const res = await searchCourseOptions(prereqSearch.trim());
                setPrereqSearchResults(res || []);
                if (res && res.length === 0) {
                    showToast("Không tìm thấy môn học nào", "warning");
                }
            } catch (err) {
                console.error("Failed to search prerequisites:", err);
                showToast("Lỗi tìm kiếm môn học", "error");
            }
        } else {
            setPrereqSearchResults([]);
        }
    };

    /* Skill panel */
    const [skillSearch, setSkillSearch] = useState('')
    const [pendingSkills, setPendingSkills] = useState([])
    const [skillTarget, setSkillTarget] = useState(null)
    const [specSkills, setSpecSkills] = useState([])
    const [fileInputKey, setFileInputKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState(null)

    /* Add Form Skills */
    const [addCourseSkills, setAddCourseSkills] = useState([]) // array of IDs
    const [addCourseNewSkills, setAddCourseNewSkills] = useState([]) // array of strings
    const [addSkillInput, setAddSkillInput] = useState('')

    /* Resources panel (inside VIEW) */
    const [resources, setResources] = useState([])
    const [newResource, setNewResource] = useState({ title: '', url: '', resourceType: 'LINK', file: null })
    const [editingResourceId, setEditingResourceId] = useState(null)
    const [editingResourceData, setEditingResourceData] = useState({ title: '', url: '', resourceType: 'LINK', displayOrder: null, file: null })

    /* Thông báo — dùng chung, hiện ở góc phải trên */
    const { toasts, showToast, dismissToast } = useCmToast()

    /* Load Courses */
    const loadCourses = useCallback(async () => {
        try {
            setLoading(true)
            const data = await getCourses({
                code: search.trim() || undefined,
                isActive: filterStatus === 'active' ? true : filterStatus === 'inactive' ? false : undefined,
                countsTowardGpa: filterGpa === 'yes' ? true : filterGpa === 'no' ? false : undefined,
                page: page - 1,
                size: itemsPerPage
            })
            setCourses(data.content || [])
            setTotalElements(data.totalElements || 0)
        } catch (err) {
            console.error("Failed to load courses:", err)
            showToast("Lỗi khi tải danh sách môn học", "error")
        } finally {
            setLoading(false)
        }
    }, [search, filterStatus, filterGpa, page, itemsPerPage])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadCourses()
    }, [loadCourses])

    useEffect(() => {
        if (location.state?.selectedId && courses.length > 0) {
            const matched = courses.find(c => c.id === location.state.selectedId);
            if (matched) {
                selectCourse(matched);
            }
        }
    }, [location.state?.selectedId, courses])

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const majorsData = await getMajors()
                const activeMajors = majorsData.filter(m => m.isActive)
                const specsList = await Promise.all(activeMajors.map(m => getSpecializationsByMajor(m.id).catch(() => [])))
                const allSpecs = specsList.flat().filter(s => s.isActive)
                const skillResults = await Promise.all(allSpecs.map(s => getSpecializationSkills(s.id).catch(() => [])))
                const uniqueSkills = Array.from(new Map(skillResults.flat().map(s => [s.id, s])).values())
                setSpecSkills(uniqueSkills)
            } catch (err) {
                console.error("Failed to load skills for course page:", err)
            }
        }
        fetchSkills()
    }, [])

    const totalPages = Math.max(1, Math.ceil(totalElements / itemsPerPage))
    const paginated = courses

    /* ── Handlers ── */
    async function selectCourse(c) {
        try {
            setLoading(true)
            const detail = await getCourseDetail(c.id)
            setSelectedCourse(detail)
            setForm({
                code: detail.code,
                name: detail.name,
                credits: detail.credits,
                countsTowardGpa: detail.countsTowardGpa,
                description: detail.description || '',
                isActive: detail.isActive
            })
            setFormErrors({})
            setPanel(PANEL.VIEW)
            setResources(detail.learningResources || [])
        } catch (err) {
            console.error("Failed to load course detail:", err)
            showToast("Không thể tải chi tiết môn học", "error")
        } finally {
            setLoading(false)
        }
    }

    function openAdd() {
        setSelectedCourse(null)
        setForm({ code: '', name: '', credits: 3, countsTowardGpa: true, description: '', isActive: true })
        setFormErrors({})
        setAddCourseSkills([])
        setAddCourseNewSkills([])
        setAddSkillInput('')
        setPanel(PANEL.ADD)
    }

    function openPrereq(course) {
        setPrereqTarget(course)
        setPendingPrereqs(course.prerequisiteGroups ? course.prerequisiteGroups.map(g => g.map(c => ({ id: c.id, code: c.code, name: c.name }))) : [])
        setPrereqSearch('')
        setPrereqSearchResults([])
        setPanel(PANEL.PREREQ)
    }

    async function openSkill(course) {
        setSkillTarget(course)
        setLoading(true)
        try {
            const specIds = course.specializationIds || []
            const skillResults = await Promise.all(specIds.map(id => getSpecializationSkills(id).catch(() => [])))
            const uniqueSkills = Array.from(new Map(skillResults.flat().filter(s => s.isActive).map(s => [s.id, s])).values())
            setSpecSkills(uniqueSkills)

            const targetId = String(course.id).toLowerCase()
            const currentSkillIds = uniqueSkills
                .filter(skill => {
                    const skillCourseIds = (skill.courseIds || (skill.courses ? skill.courses.map(c => c.id || c.courseId) : [])).map(id => String(id).toLowerCase())
                    return skillCourseIds.includes(targetId)
                })
                .map(s => s.id)
            setPendingSkills(currentSkillIds)
            setSkillSearch('')
            setPanel(PANEL.SKILL)
        } catch (err) {
            console.error("Failed to load skills for course:", err)
            showToast("Không thể tải danh sách kỹ năng", "error")
        } finally {
            setLoading(false)
        }
    }

    function validateForm() {
        const errs = {}
        if (!form.code.trim()) errs.code = 'Bắt buộc'
        else if (form.code.length > 20) errs.code = 'Tối đa 20 ký tự'
        else if (!/^[a-zA-Z0-9]+$/.test(form.code)) errs.code = 'Chỉ chữ và số'
        if (!form.name.trim()) errs.name = 'Bắt buộc'
        if (form.credits === '' || form.credits === null || form.credits === undefined || Number(form.credits) < 0 || Number(form.credits) > 10) {
            errs.credits = '0–10 tín chỉ'
        } else if (!Number.isInteger(Number(form.credits))) {
            // Số tín chỉ phải là số nguyên, trước đây 2.5 vẫn lọt (DEF_76)
            errs.credits = 'Số tín chỉ phải là số nguyên'
        }
        return errs
    }

    async function saveCourse() {
        const errs = validateForm()
        if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

        const payload = {
            code: form.code,
            name: form.name,
            credits: Number(form.credits),
            countsTowardGpa: form.countsTowardGpa,
            description: form.description || '',
            isActive: form.isActive
        }

        try {
            if (panel === PANEL.ADD) {
                // BR-10: so trùng KHÔNG phân biệt hoa/thường (DEF_75)
                if (courses.some(c => c.code.trim().toLowerCase() === form.code.trim().toLowerCase())) {
                    setFormErrors({ code: 'Mã môn đã tồn tại (NAC-35-02)' }); return
                }
                const newC = await createCourse(payload)

                // Add selected existing skills and create new skills
                try {
                    const skillPromises = [];
                    // Existing skills
                    for (const skillId of addCourseSkills) {
                        const skill = specSkills.find(s => s.id === skillId);
                        if (skill) {
                            const currentCourseIds = (skill.courseIds || (skill.courses ? skill.courses.map(c => c.id || c.courseId) : []));
                            const updated = Array.from(new Set([...currentCourseIds, newC.id]));
                            skillPromises.push(updateSkillCourseMap(skill.id, updated));
                        }
                    }
                    // New skills creation removed because it requires a specialization
                    if (skillPromises.length > 0) {
                        await Promise.all(skillPromises);
                        showToast('Đã tạo môn học và liên kết kỹ năng thành công!');
                    } else {
                        showToast('Đã tạo môn học thành công!');
                    }
                } catch (skillErr) {
                    console.error("Lỗi khi liên kết kỹ năng:", skillErr);
                    showToast('Đã tạo môn học, nhưng có lỗi khi liên kết kỹ năng.', 'warning');
                }

                setLoading(true)
                await loadCourses()
                await selectCourse(newC)
            } else {
                // BR-10: so trùng KHÔNG phân biệt hoa/thường (DEF_75)
                if (courses.some(c => c.code.trim().toLowerCase() === form.code.trim().toLowerCase() && c.id !== selectedCourse.id)) {
                    setFormErrors({ code: 'Mã môn đã tồn tại (NAC-35-02)' }); return
                }
                const updated = await updateCourse(selectedCourse.id, payload)
                showToast('Đã lưu thay đổi!')
                setLoading(true)
                await loadCourses()
                await selectCourse(updated)
            }
        } catch (err) {
            console.error("Failed to save course:", err)
            showToast("Lỗi khi lưu môn học: " + (err.response?.data?.message || err.message), "error")
        }
    }



    async function savePrereqs() {
        if (pendingPrereqs.flat().length > 5) { showToast('Tối đa 5 môn tiên quyết', 'error'); return }
        try {
            const payload = pendingPrereqs.map(g => g.map(c => c.id)).filter(g => g.length > 0);
            const updatedDetail = await updatePrerequisites(prereqTarget.id, payload)
            showToast('Đã cập nhật tiên quyết!')
            setLoading(true)
            await loadCourses()
            await selectCourse(updatedDetail)
        } catch (err) {
            console.error("Failed to update prerequisites:", err)
            showToast("Lỗi khi cập nhật môn tiên quyết: " + (err.response?.data?.message || err.message), "error")
        }
    }

    async function saveSkills() {
        if (!skillTarget) return
        try {
            setLoading(true)
            const targetCourseId = skillTarget.id
            const targetCourseIdLower = String(targetCourseId).toLowerCase()

            const updatePromises = specSkills.map(async (skill) => {
                const existingCourseIds = (skill.courseIds || (skill.courses ? skill.courses.map(c => c.id || c.courseId) : []))
                const hasCourse = existingCourseIds.some(id => String(id).toLowerCase() === targetCourseIdLower)
                const shouldHaveCourse = pendingSkills.includes(skill.id)

                if (shouldHaveCourse && !hasCourse) {
                    const updated = Array.from(new Set([...existingCourseIds, targetCourseId]))
                    await updateSkillCourseMap(skill.id, updated)
                } else if (!shouldHaveCourse && hasCourse) {
                    const updated = existingCourseIds.filter(id => String(id).toLowerCase() !== targetCourseIdLower)
                    await updateSkillCourseMap(skill.id, updated)
                }
            })

            await Promise.all(updatePromises)
            showToast('Đã cập nhật kỹ năng liên kết!')

            if (filterSpecId) {
                const data = await getSpecializationSkills(filterSpecId)
                setSpecSkills(data || [])
            } else if (filterMajorId) {
                const specsData = await getSpecializationsByMajor(filterMajorId)
                const activeSpecs = specsData.filter(s => s.isActive)
                const skillResults = await Promise.all(activeSpecs.map(s => getSpecializationSkills(s.id).catch(() => [])))
                const uniqueSkills = Array.from(new Map(skillResults.flat().map(s => [s.id, s])).values())
                setSpecSkills(uniqueSkills)
            } else {
                const majorsData = await getMajors()
                const activeMajors = majorsData.filter(m => m.isActive)
                const specsList = await Promise.all(activeMajors.map(m => getSpecializationsByMajor(m.id).catch(() => [])))
                const allSpecs = specsList.flat().filter(s => s.isActive)
                const skillResults = await Promise.all(allSpecs.map(s => getSpecializationSkills(s.id).catch(() => [])))
                const uniqueSkills = Array.from(new Map(skillResults.flat().map(s => [s.id, s])).values())
                setSpecSkills(uniqueSkills)
            }

            const updatedDetail = await getCourseDetail(targetCourseId)
            setSelectedCourse(updatedDetail)
            setPanel(PANEL.VIEW)
        } catch (err) {
            console.error("Failed to update skills:", err)
            showToast("Lỗi khi cập nhật kỹ năng liên kết: " + (err.response?.data?.message || err.message), "error")
        } finally {
            setLoading(false)
        }
    }

    async function addResource() {
        // Trước đây `return` lặng lẽ nên CM bấm nút mà không có phản hồi gì (DEF_43)
        if (!newResource.resourceType) { showToast('Vui lòng chọn loại tài nguyên', 'error'); return }
        if (!newResource.title?.trim()) { showToast('Vui lòng nhập tiêu đề tài nguyên', 'error'); return }
        if (!newResource.url && !newResource.file) {
            showToast('Vui lòng nhập liên kết hoặc chọn tệp cho tài nguyên', 'error'); return
        }
        if (resources.length >= 10) { showToast('Tối đa 10 tài nguyên', 'error'); return }
        try {
            const added = await uploadResource(selectedCourse.id, newResource.title, newResource.resourceType, newResource.url, newResource.file)
            setResources(p => [...p, added])
            setNewResource({ title: '', url: '', resourceType: 'LINK', file: null })
            // <input type="file"> không tự xoá tên tệp khi state reset -> remount bằng key (DEF_78)
            setFileInputKey(k => k + 1)
            showToast('Đã thêm tài nguyên!')
        } catch (err) {
            console.error("Failed to add resource:", err)
            showToast("Lỗi khi thêm tài nguyên: " + (err.response?.data?.message || err.message), "error")
        }
    }

    async function removeResource(id) {
        try {
            await deleteResource(id)
            setResources(p => p.filter(r => r.id !== id))
            showToast('Đã xóa tài nguyên')
        } catch (err) {
            console.error("Failed to delete resource:", err)
            showToast("Lỗi khi xóa tài nguyên: " + (err.response?.data?.message || err.message), "error")
        }
    }

    async function saveEditedResource(id) {
        // Trước đây `return` lặng lẽ, không báo gì cho CM (DEF_43)
        if (!editingResourceData.resourceType) { showToast('Vui lòng chọn loại tài nguyên', 'error'); return }
        if (!editingResourceData.title?.trim()) { showToast('Vui lòng nhập tiêu đề tài nguyên', 'error'); return }
        if (!editingResourceData.url && !editingResourceData.file) {
            showToast('Vui lòng nhập liên kết hoặc chọn tệp cho tài nguyên', 'error'); return
        }
        try {
            const updated = await updateResource(
                id,
                editingResourceData.title,
                editingResourceData.resourceType,
                editingResourceData.url,
                editingResourceData.displayOrder,
                editingResourceData.file
            )
            setResources(p => p.map(res => res.id === id ? updated : res))
            setEditingResourceId(null)
            setEditingResourceData({ title: '', url: '', resourceType: 'LINK', displayOrder: null, file: null })
            setFileInputKey(k => k + 1)
            showToast('Đã cập nhật tài nguyên!')
        } catch (err) {
            console.error("Failed to update resource:", err)
            showToast("Lỗi khi sửa tài nguyên: " + (err.response?.data?.message || err.message), "error")
        }
    }

    async function moveResourceOrder(index, direction) {
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= resources.length) return
        const prevResources = resources
        const nextResources = [...resources]
        const temp = nextResources[index]
        nextResources[index] = nextResources[targetIndex]
        nextResources[targetIndex] = temp

        setResources(nextResources)

        const orderMap = {}
        nextResources.forEach((res, idx) => {
            orderMap[res.id] = idx + 1
        })

        try {
            await updateResourceOrder(selectedCourse.id, orderMap)
            showToast('Đã cập nhật thứ tự tài nguyên!')
        } catch (err) {
            console.error("Failed to update resource order:", err)
            // Cập nhật lạc quan phải rollback khi API lỗi, nếu không màn hiện thứ tự
            // khác hẳn dữ liệu thật trên server (DEF_79)
            setResources(prevResources)
            showToast("Lỗi khi cập nhật thứ tự tài nguyên, đã khôi phục thứ tự cũ: " + (err.response?.data?.message || err.message), "error")
        }
    }

    async function confirmDeleteCourse() {
        const target = deleteTarget
        setDeleteTarget(null)
        if (!target) return
        try {
            await deleteCourse(target.id)
            showToast(`Đã xoá môn học ${target.code}`)
            setSelectedCourse(null)
            setPanel(PANEL.EMPTY)
            setLoading(true)
            await loadCourses()
        } catch (err) {
            console.error('Failed to delete course:', err)
            showToast('Không xoá được môn học: ' + (err.response?.data?.message || err.message), 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    /* ── Prerequisites for panel ── */
    const availableForPrereq = prereqSearch.trim()
        ? prereqSearchResults.filter(c => c.id !== prereqTarget?.id)
        : []

    /* ── Resource type badge ── */
    const resTypeBadge = (type) => {
        const map = { LINK: '#034EA2', ARTICLE: '#51B848', DOCS: '#6d28d9', EXERCISE: '#C45A0A' }
        return { background: map[type] + '18', color: map[type] }
    }

    /* ── Right panel ── */
    function renderPanel() {
        if (panel === PANEL.EMPTY) return (
            <div className="course-empty">
                <div className="course-empty-icon"><BookOpen size={44} strokeWidth={1.4} /></div>
                <div className="course-empty-text">Chọn một môn học để xem chi tiết<br />hoặc nhấn <strong>Thêm môn học</strong> để tạo mới</div>
            </div>
        )

        if (panel === PANEL.PREREQ && prereqTarget) {
            const selectedPrereqCourses = courses.filter(c => pendingPrereqs.includes(c.id))
            return (
                <>
                    <div className="course-rp-header">
                        <div className="course-rp-meta">
                            <div className="course-rp-eyebrow">Cấu hình tiên quyết</div>
                            <div className="course-rp-title">{prereqTarget.code} — {prereqTarget.name}</div>
                        </div>
                        <div className="course-rp-btns">
                            <button className="course-btn course-btn-ghost" onClick={() => selectCourse(prereqTarget)} type="button"><XCircle size={13} strokeWidth={2.4} /> Hủy</button>
                            <button className="course-btn course-btn-save" onClick={savePrereqs} type="button"><Save size={13} strokeWidth={2.4} /> Lưu tiên quyết</button>
                        </div>
                    </div>
                    <div className="course-rp-body">
                        {/* Search & add */}
                        <div className="course-sec-title">Tìm môn để thêm</div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <input
                                className="course-input"
                                style={{ flex: 1 }}
                                placeholder="Nhập mã môn và bấm Tìm kiếm..."
                                value={prereqSearch}
                                onChange={e => setPrereqSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSearchPrereq() }}
                            />
                            <button className="course-btn" onClick={handleSearchPrereq} type="button">
                                <Search size={14} strokeWidth={2.4} /> Tìm kiếm
                            </button>
                        </div>
                        <div className="course-prereq-list">
                            {availableForPrereq.length === 0 ? (
                                <div className="course-prereq-list-empty" style={{ padding: '16px 8px', textAlign: 'center', color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>
                                    {!prereqSearch.trim()
                                        ? "Nhập mã hoặc tên môn học để tìm kiếm môn tiên quyết"
                                        : "Không tìm thấy môn học nào phù hợp"
                                    }
                                </div>
                            ) : (
                                availableForPrereq.slice(0, 8).map(c => {
                                    const alreadyInGroupIndex = pendingPrereqs.findIndex(g => g.some(item => item.id === c.id));
                                    const already = alreadyInGroupIndex !== -1;
                                    return (
                                        <div key={c.id} className={`course-prereq-pick${already ? ' selected' : ''}`}>
                                            <div className="course-prereq-pick-info">
                                                <span className="course-prereq-chip-code">{c.code}</span>
                                                <span className="course-prereq-chip-name">{c.name}</span>
                                                <span className="course-prereq-credits">{c.credits}tc</span>
                                            </div>
                                            {already ? (
                                                <button
                                                    className="course-prereq-pick-btn active"
                                                    onClick={() => setPendingPrereqs(p => {
                                                        const next = p.map((g, idx) => idx === alreadyInGroupIndex ? g.filter(item => item.id !== c.id) : g);
                                                        return next.filter(g => g.length > 0);
                                                    })}
                                                    type="button"
                                                ><Check size={12} strokeWidth={3} /> Đã chọn</button>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button
                                                        className="course-prereq-pick-btn"
                                                        onClick={() => {
                                                            if (pendingPrereqs.flat().length >= 5) showToast('Tối đa 5 môn tiên quyết', 'error')
                                                            else setPendingPrereqs(p => [...p, [{ id: c.id, code: c.code, name: c.name }]])
                                                        }}
                                                        type="button"
                                                    ><Plus size={12} strokeWidth={3} /> Nhóm mới</button>

                                                    {pendingPrereqs.length > 0 && (
                                                        <select
                                                            className="course-input"
                                                            style={{ padding: '0 4px', fontSize: 11, height: 24, width: 'auto', minWidth: '80px' }}
                                                            value=""
                                                            onChange={(e) => {
                                                                if (pendingPrereqs.flat().length >= 5) {
                                                                    showToast('Tối đa 5 môn tiên quyết', 'error');
                                                                    return;
                                                                }
                                                                const gIndex = parseInt(e.target.value);
                                                                setPendingPrereqs(p => p.map((g, idx) => idx === gIndex ? [...g, { id: c.id, code: c.code, name: c.name }] : g));
                                                            }}
                                                        >
                                                            <option value="" disabled>+ Tùy chọn (OR)...</option>
                                                            {pendingPrereqs.map((g, idx) => (
                                                                <option key={idx} value={idx}>Nhóm {idx + 1}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Selected prereqs */}
                        <div className="course-sec-title" style={{ marginTop: 16 }}>Đã chọn</div>
                        <div className="course-prereq-selected">
                            {pendingPrereqs.length === 0
                                ? <div className="course-prereq-empty">Chưa có môn tiên quyết nào</div>
                                : pendingPrereqs.map((group, gIndex) => (
                                    <div key={gIndex} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#475569' }}>
                                            Nhóm {gIndex + 1} {group.length > 1 ? '(Hoàn thành 1 trong các môn sau)' : '(Bắt buộc)'}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {group.map(c => {
                                                return (
                                                    <div key={c.id} className="course-prereq-chip">
                                                        <span className="course-prereq-chip-code">{c.code}</span>
                                                        <span className="course-prereq-chip-name">{c.name}</span>
                                                        <button
                                                            className="course-prereq-chip-x"
                                                            onClick={() => {
                                                                setPendingPrereqs(p => {
                                                                    const next = p.map((g, idx) => idx === gIndex ? g.filter(item => item.id !== c.id) : g);
                                                                    return next.filter(g => g.length > 0);
                                                                });
                                                            }}
                                                            type="button"
                                                            aria-label="Bỏ môn tiên quyết"
                                                        ><X size={12} strokeWidth={3} /></button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </>
            )
        }

        if (panel === PANEL.SKILL && skillTarget) {
            const selectedSkills = specSkills.filter(s => pendingSkills.includes(s.id))
            const availableForSkill = skillSearch.trim()
                ? specSkills.filter(s => s.name.toLowerCase().includes(skillSearch.toLowerCase().trim()))
                : specSkills

            return (
                <>
                    <div className="course-rp-header">
                        <div className="course-rp-meta">
                            <div className="course-rp-eyebrow">Cấu hình kỹ năng liên kết</div>
                            <div className="course-rp-title">{skillTarget.code} — {skillTarget.name}</div>
                        </div>
                        <div className="course-rp-btns">
                            <button className="course-btn course-btn-ghost" onClick={() => selectCourse(skillTarget)} type="button">
                                <XCircle size={13} strokeWidth={2.4} /> Hủy
                            </button>
                            <button className="course-btn course-btn-save" onClick={saveSkills} type="button">
                                <Save size={13} strokeWidth={2.4} /> Lưu kỹ năng
                            </button>
                        </div>
                    </div>
                    <div className="course-rp-body">
                        <div className="course-prereq-info">
                            <span className="course-prereq-info-icon">ℹ</span>
                            Cấu hình danh sách Kỹ năng được rèn luyện và tích lũy thông qua môn học này.
                        </div>

                        {/* Selected Skills */}
                        <div className="course-sec-title">Đã chọn ({pendingSkills.length})</div>
                        <div className="course-prereq-selected">
                            {selectedSkills.length === 0
                                ? <div className="course-prereq-empty">Chưa gán kỹ năng nào cho môn học này</div>
                                : selectedSkills.map(s => (
                                    <div key={s.id} className="course-prereq-chip" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                                        <span className="course-prereq-chip-name" style={{ color: '#034ea2', fontWeight: 600 }}>{s.name}</span>
                                        <button
                                            className="course-prereq-chip-x"
                                            onClick={() => setPendingSkills(p => p.filter(id => id !== s.id))}
                                            type="button"
                                            aria-label="Xóa kỹ năng"
                                        ><X size={12} strokeWidth={3} /></button>
                                    </div>
                                ))
                            }
                        </div>

                        {/* Search & Add */}
                        <div className="course-sec-title" style={{ marginTop: 16 }}>Tìm kỹ năng để thêm</div>
                        <input
                            className="course-input"
                            placeholder="Nhập tên kỹ năng để tìm..."
                            value={skillSearch}
                            onChange={e => setSkillSearch(e.target.value)}
                        />
                        <div className="course-prereq-list">
                            {availableForSkill.length === 0 ? (
                                <div className="course-prereq-list-empty" style={{ padding: '16px 8px', textAlign: 'center', color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>
                                    {!skillSearch.trim()
                                        ? "Nhập tên kỹ năng để tìm kiếm"
                                        : "Không tìm thấy kỹ năng nào phù hợp"
                                    }
                                </div>
                            ) : (
                                availableForSkill.slice(0, 15).map(s => {
                                    const already = pendingSkills.includes(s.id)
                                    return (
                                        <div key={s.id} className={`course-prereq-pick${already ? ' selected' : ''}`}>
                                            <div className="course-prereq-pick-info">
                                                <span className="course-prereq-chip-name" style={{ fontWeight: 600 }}>{s.name}</span>
                                            </div>
                                            <button
                                                className={`course-prereq-pick-btn${already ? ' active' : ''}`}
                                                onClick={() => {
                                                    if (already) setPendingSkills(p => p.filter(id => id !== s.id))
                                                    else setPendingSkills(p => [...p, s.id])
                                                }}
                                                type="button"
                                            >{already
                                                ? <><Check size={12} strokeWidth={3} /> Đã chọn</>
                                                : <><Plus size={12} strokeWidth={3} /> Thêm</>}</button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </>
            )
        }

        const isAdd = panel === PANEL.ADD
        const course = selectedCourse

        return (
            <>
                <div className="course-rp-header">
                    <div className="course-rp-meta">
                        <div className="course-rp-eyebrow">{isAdd ? 'Thêm môn học mới' : `Môn học · ${course?.code}`}</div>
                        <div className="course-rp-title">{isAdd ? 'Môn học mới' : course?.name}</div>
                    </div>
                    <div className="course-rp-btns">
                        {/* Backend đã có DELETE /courses/{id} nhưng UI chưa hề có lối xoá (DEF_44) */}
                        {!isAdd && course && (
                            <button
                                className="course-btn course-btn-danger"
                                onClick={() => setDeleteTarget(course)}
                                type="button"
                            >
                                <Trash2 size={13} strokeWidth={2.4} /> Xoá môn học
                            </button>
                        )}
                        <button className="course-btn course-btn-save" onClick={saveCourse} type="button">
                            {isAdd ? <><Plus size={13} strokeWidth={2.6} /> Tạo môn học</> : <><Save size={13} strokeWidth={2.4} /> Lưu thay đổi</>}
                        </button>
                    </div>
                </div>

                <div className="course-rp-body">
                    {/* Status Dropdown */}
                    {!isAdd && (
                        <div className="course-status-row">
                            <span className="course-status-label">Trạng thái môn học</span>
                            <CmSelect
                                size="sm"
                                tinted
                                width="190px"
                                value={form.isActive ? 'active' : 'inactive'}
                                onChange={val => setForm(p => ({ ...p, isActive: val === 'active' }))}
                                options={[
                                    { value: 'active', label: 'Đang kích hoạt', tone: 'green' },
                                    { value: 'inactive', label: 'Đã vô hiệu hóa', tone: 'gray' }
                                ]}
                            />
                        </div>
                    )}

                    {/* Form */}
                    <div className="course-form-grid">
                        <FormField label="Mã môn" required error={formErrors.code} hint="Tối đa 20 ký tự, chỉ chữ và số">
                            <input
                                className={`course-input${formErrors.code ? ' has-error' : ''}`}
                                placeholder="Ví dụ: ML401"
                                maxLength={20}
                                value={form.code}
                                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                            />
                        </FormField>
                        <FormField label="Số tín chỉ" required error={formErrors.credits} hint="0–10">
                            <input
                                className={`course-input${formErrors.credits ? ' has-error' : ''}`}
                                type="number"
                                min={0}
                                max={10}
                                value={form.credits}
                                onChange={e => setForm(p => ({ ...p, credits: e.target.value }))}
                            />
                        </FormField>
                    </div>

                    <FormField label="Tên môn học" required error={formErrors.name}>
                        <input
                            className={`course-input${formErrors.name ? ' has-error' : ''}`}
                            placeholder="Ví dụ: Học máy"
                            maxLength={255}
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                    </FormField>

                    <FormField label="Mô tả">
                        <textarea
                            className="course-input course-textarea"
                            placeholder="Mô tả ngắn về môn học (tùy chọn)..."
                            value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        />
                    </FormField>

                    <label className="course-checkbox-row">
                        <input
                            type="checkbox"
                            className="course-checkbox"
                            checked={form.countsTowardGpa}
                            onChange={e => setForm(p => ({ ...p, countsTowardGpa: e.target.checked }))}
                        />
                        <div>
                            <div className="course-checkbox-label">Tính vào GPA</div>
                            <div className="course-checkbox-hint">Bỏ check cho các môn như OJT, Giáo dục QP, Vovinam</div>
                        </div>
                    </label>

                    {/* Skills Add Section */}
                    {isAdd && (
                        <>
                            <div className="course-divider" />
                            <div className="course-sec-title">Kỹ năng liên kết (Tuỳ chọn)</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        className="course-input"
                                        placeholder="Tìm hoặc nhập tên kỹ năng mới..."
                                        value={addSkillInput}
                                        onChange={e => setAddSkillInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = addSkillInput.trim();
                                                if (!val) return;
                                                const existingSkill = specSkills.find(s => s.name.toLowerCase() === val.toLowerCase());
                                                if (existingSkill) {
                                                    if (!addCourseSkills.includes(existingSkill.id)) {
                                                        setAddCourseSkills(prev => [...prev, existingSkill.id]);
                                                    }
                                                } else {
                                                    const existingNew = addCourseNewSkills.find(n => n.toLowerCase() === val.toLowerCase());
                                                    if (!existingNew) {
                                                        setAddCourseNewSkills(prev => [...prev, val]);
                                                    }
                                                }
                                                setAddSkillInput('');
                                            }
                                        }}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="course-btn course-btn-ghost"
                                        onClick={() => {
                                            const val = addSkillInput.trim();
                                            if (!val) return;
                                            const existingSkill = specSkills.find(s => s.name.toLowerCase() === val.toLowerCase());
                                            if (existingSkill) {
                                                if (!addCourseSkills.includes(existingSkill.id)) {
                                                    setAddCourseSkills(prev => [...prev, existingSkill.id]);
                                                }
                                            } else {
                                                const existingNew = addCourseNewSkills.find(n => n.toLowerCase() === val.toLowerCase());
                                                if (!existingNew) {
                                                    setAddCourseNewSkills(prev => [...prev, val]);
                                                }
                                            }
                                            setAddSkillInput('');
                                        }}
                                    >
                                        Thêm
                                    </button>
                                </div>

                                {addSkillInput.trim() && (
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff' }}>
                                        {specSkills
                                            .filter(s => s.name.toLowerCase().includes(addSkillInput.toLowerCase()) && !addCourseSkills.includes(s.id))
                                            .map(s => (
                                                <div
                                                    key={s.id}
                                                    style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                                                    onClick={() => {
                                                        setAddCourseSkills(prev => [...prev, s.id]);
                                                        setAddSkillInput('');
                                                    }}
                                                >
                                                    {s.name}
                                                </div>
                                            ))}
                                        {!specSkills.some(s => s.name.toLowerCase() === addSkillInput.trim().toLowerCase()) && (
                                            <div
                                                style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '13px', color: '#034ea2', fontWeight: 500 }}
                                                onClick={() => {
                                                    if (!addCourseNewSkills.find(n => n.toLowerCase() === addSkillInput.trim().toLowerCase())) {
                                                        setAddCourseNewSkills(prev => [...prev, addSkillInput.trim()]);
                                                    }
                                                    setAddSkillInput('');
                                                }}
                                            >
                                                + Tạo kỹ năng mới: "{addSkillInput.trim()}"
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="course-prereq-tags" style={{ marginTop: '4px' }}>
                                    {addCourseSkills.map(id => {
                                        const s = specSkills.find(sk => sk.id === id);
                                        return s ? (
                                            <span key={id} className="course-prereq-tag" style={{ background: '#edf4ff', color: '#034ea2', borderColor: '#93c5fd' }}>
                                                {s.name}
                                                <X size={12} style={{ marginLeft: 4, cursor: 'pointer' }} onClick={() => setAddCourseSkills(prev => prev.filter(i => i !== id))} />
                                            </span>
                                        ) : null;
                                    })}
                                    {addCourseNewSkills.map(name => (
                                        <span key={name} className="course-prereq-tag" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
                                            {name} (Mới)
                                            <X size={12} style={{ marginLeft: 4, cursor: 'pointer' }} onClick={() => setAddCourseNewSkills(prev => prev.filter(n => n !== name))} />
                                        </span>
                                    ))}
                                    {addCourseSkills.length === 0 && addCourseNewSkills.length === 0 && (
                                        <span className="course-prereq-none" style={{ marginTop: 0 }}>Chưa chọn kỹ năng nào</span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Prerequisites section */}
                    {!isAdd && (() => {
                        const flatPrereqs = course?.prerequisiteGroups ? course.prerequisiteGroups.flat() : [];
                        if (flatPrereqs.length > 0) {
                            return (
                                <>
                                    <div className="course-divider" />
                                    <div className="course-sec-title">Môn tiên quyết</div>
                                    <div className="course-prereq-tags">
                                        {flatPrereqs.map(p => (
                                            <span key={p.id} className="course-prereq-tag">
                                                {p.code} — {p.name}
                                            </span>
                                        ))}
                                        <button className="course-prereq-edit-btn" onClick={() => openPrereq(course)} type="button">
                                            <Pencil size={12} strokeWidth={2.4} /> Chỉnh sửa
                                        </button>
                                    </div>
                                </>
                            );
                        } else {
                            return (
                                <>
                                    <div className="course-divider" />
                                    <div className="course-prereq-tags">
                                        <span className="course-prereq-none">Chưa có môn tiên quyết</span>
                                        <button className="course-prereq-edit-btn" onClick={() => openPrereq(course)} type="button">
                                            + Thêm tiên quyết
                                        </button>
                                    </div>
                                </>
                            );
                        }
                    })()}

                    {/* Linked Skills section */}
                    {!isAdd && (() => {
                        const targetId = String(selectedCourse?.id || '').toLowerCase();
                        const rawLinked = specSkills.filter(skill => {
                            const skillCourseIds = (skill.courseIds || (skill.courses ? skill.courses.map(c => c.id || c.courseId) : [])).map(id => String(id).toLowerCase());
                            return targetId && skillCourseIds.includes(targetId);
                        });
                        const linkedSkills = Array.from(
                            new Map(rawLinked.map(s => [s.name.trim().toLowerCase(), s])).values()
                        );

                        if (linkedSkills.length > 0) {
                            return (
                                <>
                                    <div className="course-divider" />
                                    <div className="course-sec-title">Kỹ năng liên kết</div>
                                    <div className="course-prereq-tags">
                                        {linkedSkills.map(s => (
                                            <span key={s.id} className="course-prereq-tag" style={{ background: '#edf4ff', color: '#034ea2', borderColor: '#93c5fd' }}>
                                                {s.name}
                                            </span>
                                        ))}
                                        <button className="course-prereq-edit-btn" onClick={() => openSkill(selectedCourse)} type="button">
                                            <Pencil size={12} strokeWidth={2.4} /> Chỉnh sửa
                                        </button>
                                    </div>
                                </>
                            );
                        } else {
                            return (
                                <>
                                    <div className="course-divider" />
                                    <div className="course-prereq-tags">
                                        <span className="course-prereq-none">Chưa có kỹ năng liên kết</span>
                                        <button className="course-prereq-edit-btn" onClick={() => openSkill(selectedCourse)} type="button">
                                            + Thêm kỹ năng
                                        </button>
                                    </div>
                                </>
                            );
                        }
                    })()}

                    {/* Learning Resources */}
                    {!isAdd && (
                        <>
                            <div className="course-divider" />
                            <div className="course-sec-title" style={{ marginBottom: 12 }}>
                                Tài nguyên học tập
                                <span className="course-resource-count">{resources.length}/10</span>
                            </div>

                            <div className="course-resources-body">
                                {/* Resource list */}
                                <div className="course-resource-list" style={{ marginBottom: '16px' }}>
                                    {resources.length === 0
                                        ? <div className="course-prereq-empty">Chưa có tài nguyên nào</div>
                                        : resources.map((r, i) => (
                                            <div key={r.id} className="course-resource-item" style={{ flexDirection: editingResourceId === r.id ? 'column' : 'row', alignItems: editingResourceId === r.id ? 'stretch' : 'center', gap: '8px' }}>
                                                {editingResourceId === r.id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <select
                                                                className="course-input course-select"
                                                                value={editingResourceData.resourceType}
                                                                onChange={e => setEditingResourceData(p => ({ ...p, resourceType: e.target.value }))}
                                                                style={{ width: '120px' }}
                                                            >
                                                                {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                            <input
                                                                type="number"
                                                                className="course-input"
                                                                value={editingResourceData.displayOrder || ''}
                                                                onChange={e => setEditingResourceData(p => ({ ...p, displayOrder: e.target.value ? parseInt(e.target.value, 10) : null }))}
                                                                placeholder="Thứ tự..."
                                                                style={{ width: '80px' }}
                                                                title="Thứ tự hiển thị"
                                                            />
                                                            <input
                                                                className="course-input"
                                                                value={editingResourceData.title}
                                                                onChange={e => setEditingResourceData(p => ({ ...p, title: e.target.value }))}
                                                                placeholder="Tên học liệu..."
                                                                style={{ flex: 1 }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            {(editingResourceData.resourceType === 'DOCS' || editingResourceData.resourceType === 'EXERCISE') ? (
                                                                <input
                                                                    key={fileInputKey}
                                                                    type="file"
                                                                    className="course-input"
                                                                    onChange={e => setEditingResourceData(p => ({ ...p, file: e.target.files[0] }))}
                                                                    style={{ flex: 1, padding: '5px' }}
                                                                />
                                                            ) : (
                                                                <input
                                                                    className="course-input"
                                                                    value={editingResourceData.url || ''}
                                                                    onChange={e => setEditingResourceData(p => ({ ...p, url: e.target.value }))}
                                                                    placeholder="Đường dẫn liên kết..."
                                                                    style={{ flex: 1 }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                                            <button className="course-btn course-btn-save course-btn-xs" onClick={() => saveEditedResource(r.id)} type="button">
                                                                Lưu
                                                            </button>
                                                            <button className="course-btn course-btn-ghost course-btn-xs" onClick={() => setEditingResourceId(null)} type="button">
                                                                Hủy
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="course-resource-order">{i + 1}</span>
                                                        <div className="course-resource-info" style={{ flex: 1 }}>
                                                            <div className="course-resource-title">{r.title}</div>
                                                            <a className="course-resource-url" href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                                                        </div>
                                                        <span className="course-resource-type" style={resTypeBadge(r.resourceType)}>{r.resourceType}</span>
                                                        <div style={{ display: 'flex', gap: '2px', marginRight: '4px' }}>
                                                            <button
                                                                type="button"
                                                                disabled={i === 0}
                                                                onClick={() => moveResourceOrder(i, 'up')}
                                                                style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '11px' }}
                                                                title="Di chuyển lên"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={i === resources.length - 1}
                                                                onClick={() => moveResourceOrder(i, 'down')}
                                                                style={{ background: 'none', border: 'none', cursor: i === resources.length - 1 ? 'default' : 'pointer', opacity: i === resources.length - 1 ? 0.3 : 1, fontSize: '11px' }}
                                                                title="Di chuyển xuống"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                        <button
                                                            className="course-resource-edit"
                                                            onClick={() => {
                                                                setEditingResourceId(r.id)
                                                                setEditingResourceData({ title: r.title, url: r.url, resourceType: r.resourceType, displayOrder: r.displayOrder, file: null })
                                                            }}
                                                            type="button"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', marginRight: '4px' }}
                                                            title="Chỉnh sửa tài nguyên"
                                                        >
                                                            <Pencil size={13} strokeWidth={2.4} />
                                                        </button>
                                                        <button className="course-resource-del" onClick={() => removeResource(r.id)} type="button" aria-label="Xoá tài nguyên"><X size={13} strokeWidth={3} /></button>
                                                    </>
                                                )}
                                            </div>
                                        ))
                                    }
                                </div>

                                {/* Add new resource form - Resource Type First */}
                                <div className="course-resource-add" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div className="course-sec-title">Thêm học liệu mới</div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <select
                                            className="course-input course-select"
                                            value={newResource.resourceType}
                                            onChange={e => setNewResource(p => ({ ...p, resourceType: e.target.value }))}
                                            style={{ width: '140px' }}
                                        >
                                            {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <input
                                            className="course-input"
                                            placeholder="Tên học liệu..."
                                            value={newResource.title}
                                            onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))}
                                            style={{ flex: 1 }}
                                        />
                                    </div>

                                    {(newResource.resourceType === 'DOCS' || newResource.resourceType === 'EXERCISE') ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input
                                                key={fileInputKey}
                                                type="file"
                                                className="course-input"
                                                onChange={e => setNewResource(p => ({ ...p, file: e.target.files[0] }))}
                                                style={{ flex: 1, padding: '5px' }}
                                            />
                                            <button className="course-btn course-btn-save course-btn-nowrap" onClick={addResource} type="button"><Upload size={13} strokeWidth={2.4} /> Tải tệp lên</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input
                                                className="course-input"
                                                placeholder="Đường dẫn liên kết (https://...)"
                                                value={newResource.url}
                                                onChange={e => setNewResource(p => ({ ...p, url: e.target.value }))}
                                                style={{ flex: 1 }}
                                            />
                                            <button className="course-btn course-btn-save course-btn-nowrap" onClick={addResource} type="button"><Plus size={13} strokeWidth={2.6} /> Thêm liên kết</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {isAdd && (
                        <p className="course-form-note">
                            Sau khi tạo, bạn có thể cấu hình <strong>tiên quyết</strong> và <strong>tài nguyên học tập</strong> từ trang chi tiết môn.
                        </p>
                    )}
                </div>
            </>
        )
    }

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="course-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><BookOpen size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Danh mục môn học</h1>
                            <p className="cm-page-sub">
                                Quản lý thông tin môn học, số tín chỉ, môn tiên quyết và học liệu đi kèm
                            </p>
                        </div>
                    </div>
                </header>


                <div className="course-wrap">
                    {/* ══ LEFT: list ══ */}
                    <div className="course-list-panel">
                        {/* Toolbar */}
                        <div className="course-list-top">
                            <div className="course-list-search-row">
                                <input
                                    className="course-search"
                                    placeholder="Tìm theo mã môn học..."
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                    <button
                                        className="course-btn course-btn-save"
                                        onClick={openAdd}
                                        type="button"
                                    >
                                        <Plus size={14} strokeWidth={2.6} /> Thêm môn học
                                    </button>
                                </div>
                            </div>
                            <div className="course-filter-row" style={{ flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                <select
                                    className={`course-filter-select${filterGpa !== '' ? ' active' : ''}`}
                                    value={filterGpa}
                                    onChange={e => {
                                        setFilterGpa(e.target.value)
                                        setPage(1)
                                    }}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Tất cả tính điểm</option>
                                    <option value="yes">Tính vào GPA</option>
                                    <option value="no">Không tính GPA</option>
                                </select>
                                <select
                                    className={`course-filter-select${filterStatus !== '' ? ' active' : ''}`}
                                    value={filterStatus}
                                    onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Tất cả trạng thái</option>
                                    <option value="active">Đang hoạt động</option>
                                    <option value="inactive">Đã tắt</option>
                                </select>
                                <span className="course-count-label">{totalElements} môn</span>
                            </div>
                        </div>

                        {/* List */}
                        <div className="course-list-scroll">
                            {loading && <div className="course-list-empty">Đang tải...</div>}
                            {!loading && courses.length === 0 && (
                                <div className="course-list-empty">
                                    Không tìm thấy môn học nào khớp bộ lọc
                                </div>
                            )}
                            {!loading && paginated.map(c => {
                                const isSel = selectedCourse?.id === c.id && panel !== PANEL.ADD
                                return (
                                    <div
                                        key={c.id}
                                        className={`course-row${isSel ? ' sel' : ''}${!c.isActive ? ' inactive' : ''}`}
                                        onClick={() => selectCourse(c)}
                                    >
                                        <div className="course-row-left">
                                            <span className={`course-row-dot ${c.isActive ? 'dot-active' : 'dot-hidden'}`} />
                                            <div>
                                                <div className="course-row-code">{c.code}</div>
                                                <div className="course-row-name">{c.name}</div>
                                            </div>
                                        </div>
                                        <div className="course-row-right">
                                            <span className="course-row-credits">{c.credits}tc</span>
                                            {!c.countsTowardGpa && <span className="course-row-nogpa">No GPA</span>}
                                            {c.prerequisiteCodes?.length > 0 && (
                                                <span className="course-row-prereq" title="Có môn tiên quyết"><Link2 size={11} strokeWidth={2.6} />{c.prerequisiteCodes.length}</span>
                                            )}
                                            {/* Đặc tả yêu cầu hiện số tài nguyên trên mỗi dòng môn (DEF_72) */}
                                            <span className="course-row-resources" title="Số tài nguyên học tập">
                                                <Upload size={11} strokeWidth={2.6} />
                                                {c.learningResources?.length ?? c.resourceCount ?? 0}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Pagination Control */}
                        <div className="course-pagination">
                            <CmPagination
                                page={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                bare
                                center
                            />
                        </div>
                    </div>

                    {/* ══ RIGHT: detail ══ */}
                    <div className="course-right-panel">
                        {renderPanel()}
                    </div>
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />

            {deleteTarget && (
                <div className="course-modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="course-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="course-modal-title">
                            <AlertTriangle size={16} strokeWidth={2.4} /> Xoá môn học này?
                        </div>
                        <p className="course-modal-text">
                            Môn <strong>{deleteTarget.code} — {deleteTarget.name}</strong> sẽ bị xoá khỏi hệ thống.
                            Các Chuyên ngành hẹp và lộ trình đang tham chiếu tới môn này sẽ mất môn tương ứng.
                            Thao tác không hoàn tác được.
                        </p>
                        <div className="course-modal-actions">
                            <button type="button" className="course-btn" onClick={() => setDeleteTarget(null)}>Không xoá</button>
                            <button type="button" className="course-btn course-btn-danger" onClick={confirmDeleteCourse}>Xác nhận xoá</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

/* ── FormField helper ── */
function FormField({ label, required, hint, error, children }) {
    return (
        <div className="course-form-field">
            <div className="course-form-label">
                {label}{required && <span className="course-req">*</span>}
            </div>
            {children}
            {error && <div className="course-field-error"><AlertTriangle size={12} strokeWidth={2.6} /> {error}</div>}
            {hint && !error && <div className="course-field-hint">{hint}</div>}
        </div>
    )
}
