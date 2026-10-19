import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Globe, Heart, Plus, Pencil, Save, XCircle, Search } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmCatalogFilter from '../../components/cm/CmCatalogFilter'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization } from '../../services/catalogService'
import {
    getSpecializationInterests,
    createInterest,
    updateInterest,
    updateInterestStatus
} from '../../services/interestService'
import { getTagMap, updateTagMap } from '../../services/tagMapService'
import './CmInterestsPage.css'

const LABEL_MAX = 255
const LOOKS_VI = /[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]/i

const emptyForm = { label: '', isActive: true, targetMajorId: '', targetSpecId: '', targetNsId: '' }

const STATUS_FILTERS = [
    { key: 'all', label: 'Tất cả' },
    { key: 'active', label: 'Đang dùng' },
    { key: 'inactive', label: 'Đã tắt' },
]

const STATUS_OPTIONS = [
    { value: 'active', label: 'Đang dùng', tone: 'green' },
    { value: 'inactive', label: 'Đã tắt', tone: 'gray' },
]

export default function CmInterestsPage() {
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
    const [nsInterestIds, setNsInterestIds] = useState(null)
    const [interests, setInterests] = useState([])
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [formMode, setFormMode] = useState('create') // 'create' | 'edit'
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [viewAllCatalog, setViewAllCatalog] = useState(!targetMajorId && !targetSpecId)
    const prevFiltersRef = useRef(null)
    const isRestoringRef = useRef(false)
    const originalSpecIdRef = useRef(null)
    const [allCatalogSpecs, setAllCatalogSpecs] = useState([])
    const [formSpecs, setFormSpecs] = useState([])
    const [formNarrowSpecs, setFormNarrowSpecs] = useState([])

    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const loadAllCatalogInterests = useCallback(async () => {
        try {
            const allMajorsData = await getMajors()
            const activeM = (allMajorsData || []).filter(m => m.isActive)
            const specsNested = await Promise.all(activeM.map(m => getSpecializationsByMajor(m.id).catch(() => [])))
            const flatSpecs = specsNested.flat().filter(s => s.isActive)
            const interestResults = await Promise.all(
                flatSpecs.map(s =>
                    getSpecializationInterests(s.id)
                        .then(items => (items || []).map(it => ({
                            ...it,
                            specName: s.name,
                            updatedAt: it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('vi-VN') : '—'
                        })))
                        .catch(() => [])
                )
            )
            setInterests(interestResults.flat())
        } catch (err) {
            console.error('Không tải được toàn bộ sở thích:', err)
            showToast('Không tải được danh sách sở thích toàn hệ thống', 'error')
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
                    loadAllCatalogInterests()
                }
            })
            .catch(err => console.error('Không tải được danh sách ngành:', err))
    }, [targetMajorId, targetSpecId, loadAllCatalogInterests])

    const handleToggleViewAll = async () => {
        const nextState = !viewAllCatalog
        setViewAllCatalog(nextState)
        if (nextState) {
            // Nhớ bộ lọc để khôi phục khi tắt chế độ xem toàn bộ
            prevFiltersRef.current = { majorId, specId, selectedNsId }
            setMajorId('')
            setSpecId('')
            setSelectedNsId('')
            setNsInterestIds(null)
            setSpecializations([])
            setNarrowSpecs([])
            await loadAllCatalogInterests()
        } else {
            const prev = prevFiltersRef.current
            if (prev?.majorId) {
                isRestoringRef.current = true
                setMajorId(prev.majorId)
                setSpecId(prev.specId || '')
                setSelectedNsId(prev.selectedNsId || '')
            } else {
                await loadAllCatalogInterests()
            }
        }
    }

    const closeForm = useCallback(() => {
        setFormMode('create')
        setEditingId(null)
        setForm({ ...emptyForm, targetMajorId: majorId || '', targetSpecId: specId || '' })
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
                    // Tải sở thích của tất cả chuyên ngành trong ngành được chọn
                    Promise.all(
                        activeSpecs.map(s =>
                            getSpecializationInterests(s.id)
                                .then(items => (items || []).map(it => ({
                                    ...it,
                                    specName: s.name,
                                    updatedAt: it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('vi-VN') : '—'
                                })))
                                .catch(() => [])
                        )
                    ).then(results => {
                        setInterests(results.flat())
                    })
                }
            })
            .catch(err => console.error('Không tải được danh sách chuyên ngành:', err))
    }, [majorId, targetSpecId])

    useEffect(() => {
        if (!specId) {
            setNarrowSpecs([])
            setSelectedNsId('')
            setNsInterestIds(null)
            return
        }
        getNarrowSpecsBySpecialization(specId)
            .then(data => setNarrowSpecs(data || []))
            .catch(err => console.error('Không tải được danh sách chuyên ngành hẹp:', err))

        getSpecializationInterests(specId)
            .then(data => {
                const specObj = specializations.find(s => s.id === specId) || allCatalogSpecs.find(s => s.id === specId)
                setInterests((data || []).map(it => ({
                    ...it,
                    specName: specObj?.name || '',
                    updatedAt: it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('vi-VN') : '—'
                })))
            })
            .catch(err => console.error('Không tải được danh sách sở thích:', err))
    }, [specId, specializations, allCatalogSpecs])

    /* Khi lọc theo chuyên ngành hẹp: chỉ giữ lại sở thích đã ánh xạ cho nó */
    useEffect(() => {
        if (!selectedNsId) return
        getTagMap(selectedNsId)
            .then(data => {
                const list = Array.isArray(data) ? data : (data.interestIds || data.interests || [])
                const ids = list
                    .filter(entry => entry.sourceType === 'INTEREST' || entry.interestId || entry.sourceId || typeof entry === 'string' || typeof entry === 'number')
                    .map(entry => typeof entry === 'object' ? (entry.sourceId || entry.interestId || entry.id) : entry)
                setNsInterestIds(new Set(ids))
            })
            .catch(err => {
                console.error('Không tải được ánh xạ của chuyên ngành hẹp:', err)
                // Giữ Set rỗng sẽ lọc sạch bảng như thể CNH chưa ánh xạ gì.
                // Trả null = tắt bộ lọc và báo cho CM biết (DEF_54)
                setNsInterestIds(null)
                showToast('Không tải được ánh xạ của chuyên ngành hẹp — bộ lọc theo CNH tạm thời không áp dụng', 'error')
            })
    }, [selectedNsId, showToast])

    const handleMajorChange = (value) => {
        setMajorId(value)
        setSpecId('')
        setSelectedNsId('')
        setSpecializations([])
        setNarrowSpecs([])
        setNsInterestIds(null)
        setCurrentPage(1)
        if (!value) {
            setViewAllCatalog(true)
            loadAllCatalogInterests()
        } else {
            setViewAllCatalog(false)
        }
    }

    const handleSpecChange = (value) => {
        setSpecId(value)
        setSelectedNsId('')
        setNarrowSpecs([])
        setNsInterestIds(null)
        setCurrentPage(1)
        if (!value) {
            if (majorId) {
                // Tải sở thích của tất cả chuyên ngành trong ngành đang chọn
                Promise.all(
                    specializations.map(s =>
                        getSpecializationInterests(s.id)
                            .then(items => (items || []).map(it => ({
                                ...it,
                                specName: s.name,
                                updatedAt: it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('vi-VN') : '—'
                            })))
                            .catch(() => [])
                    )
                ).then(results => setInterests(results.flat()))
            } else {
                setViewAllCatalog(true)
                loadAllCatalogInterests()
            }
        } else {
            setViewAllCatalog(false)
        }
    }

    const handleNsChange = (value) => {
        setSelectedNsId(value)
        setNsInterestIds(null)
        setCurrentPage(1)
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return interests.filter((it) => {
            if (statusFilter === 'active' && !it.isActive) return false
            if (statusFilter === 'inactive' && it.isActive) return false
            if (nsInterestIds !== null && !nsInterestIds.has(it.id)) return false
            if (!q) return true
            return it.label.toLowerCase().includes(q)
        })
    }, [interests, query, statusFilter, nsInterestIds])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const paginatedInterests = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filtered.slice(start, start + pageSize)
    }, [filtered, currentPage, pageSize])

    // Ở chế độ "xem toàn bộ danh mục", `interests` chứa cả sở thích của chuyên ngành khác
    // nên so trùng trên toàn mảng sẽ chặn nhầm nhãn hợp lệ ở chuyên ngành đích (DEF_57)
    const labelExists = useCallback((label, excludeId, targetSpecId) => {
        const n = label.trim().toLowerCase()
        return interests.some((it) => {
            if (it.id === excludeId) return false
            if (targetSpecId && it.specializationId && it.specializationId !== targetSpecId) return false
            return it.label.trim().toLowerCase() === n
        })
    }, [interests])

    const openCreate = () => {
        const initialMajor = majorId || (majors[0]?.id || '')
        const initialSpec = specId || (allCatalogSpecs[0]?.id || '')
        setForm({ ...emptyForm, targetMajorId: initialMajor, targetSpecId: initialSpec })
        if (initialMajor) {
            getSpecializationsByMajor(initialMajor).then(data => {
                setFormSpecs((data || []).filter(s => s.isActive))
            }).catch(() => {})
        }
        originalSpecIdRef.current = null
        setEditingId(null)
        setFormMode('create')
    }

    const openEdit = (item) => {
        const itemSpec = allCatalogSpecs.find(s => s.id === item.specializationId)
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
            label: item.label,
            isActive: item.isActive !== false,
            targetMajorId: itemMajorId,
            targetSpecId: item.specializationId || specId || '',
            // Giữ lại CNH đích đã chọn thay vì luôn reset về rỗng khi mở form sửa (DEF_55)
            targetNsId: item.targetNsId || item.narrowSpecId || selectedNsId || ''
        })
        originalSpecIdRef.current = item.specializationId || specId || ''
        setEditingId(item.id)
        setFormMode('edit')
    }

    /* UC-38 / UC-39 */
    const handleSubmit = async (e) => {
        e.preventDefault()
        const trimmed = form.label.trim()
        if (!trimmed) {
            showToast('Vui lòng nhập tên sở thích', 'warning')
            return
        }
        if (trimmed.length > LABEL_MAX) {
            // Nhãn dài 256 ký tự trước đây lọt thẳng lên server (DEF_59)
            showToast(`Tên sở thích không được vượt quá ${LABEL_MAX} ký tự`, 'warning')
            return
        }
        const targetSpec = form.targetSpecId || specId
        if (!targetSpec) {
            showToast('Vui lòng chọn chuyên ngành cho sở thích này', 'warning')
            return
        }
        if (labelExists(trimmed, editingId, targetSpec)) {
            showToast('Sở thích này đã tồn tại trong chuyên ngành đã chọn', 'warning')
            return
        }
        // Đổi chuyên ngành đích khi SỬA sẽ làm lệch với khai báo sinh viên đã có (DEF_63)
        if (formMode === 'edit' && originalSpecIdRef.current && targetSpec !== originalSpecIdRef.current) {
            const ok = window.confirm(
                'Bạn đang chuyển sở thích này sang chuyên ngành khác. Những sinh viên đã khai báo sở thích ' +
                'này ở chuyên ngành cũ sẽ không còn khớp với danh mục. Bạn có chắc chắn không?'
            )
            if (!ok) return
        }

        setSaving(true)
        try {
            if (formMode === 'create') {
                const newInterest = await createInterest({ specializationId: targetSpec, label: trimmed })
                // POST đã thành công: dù PATCH trạng thái lỗi thì bản ghi vẫn tồn tại,
                // không để catch ngoài nuốt mất dòng vừa tạo (DEF_60)
                if (form.isActive === false) {
                    try {
                        await updateInterestStatus(newInterest.id, false)
                        newInterest.isActive = false
                    } catch (statusErr) {
                        console.error('Tạo được sở thích nhưng không tắt được trạng thái:', statusErr)
                        newInterest.isActive = true
                        showToast(`Đã tạo "${trimmed}" nhưng chưa chuyển được sang trạng thái Đã tắt. Hãy đổi lại trạng thái ở bảng.`, 'warning')
                    }
                }
                setInterests(prev => [{
                    ...newInterest,
                    updatedAt: newInterest.updatedAt
                        ? new Date(newInterest.updatedAt).toLocaleDateString('vi-VN')
                        : new Date().toLocaleDateString('vi-VN')
                }, ...prev].filter(it => {
                    // Không chèn bản ghi thuộc chuyên ngành khác vào bảng đang lọc (DEF_61)
                    if (viewAllCatalog) return true
                    if (!specId) return true
                    return !it.specializationId || it.specializationId === specId
                }))
                if (!viewAllCatalog && specId && targetSpec !== specId) {
                    showToast(`Đã tạo "${trimmed}" cho chuyên ngành khác — chuyển bộ lọc sang chuyên ngành đó để xem`, 'info')
                } else {
                    showToast(`Đã tạo sở thích "${trimmed}"`)
                }

                if (!viewAllCatalog && selectedNsId) {
                    try {
                        const currentMap = await getTagMap(selectedNsId)
                        const entries = currentMap.map(entry => ({
                            sourceType: entry.sourceType,
                            sourceId: entry.sourceId || entry.id,
                            mappingType: entry.mappingType || 'REQUIRED',
                            weight: entry.weight || 1.0
                        }))
                        entries.push({
                            sourceType: 'INTEREST',
                            sourceId: newInterest.id,
                            mappingType: 'REQUIRED',
                            weight: 1.0
                        })
                        await updateTagMap(selectedNsId, entries)
                        showToast(`Đã tự động ánh xạ "${trimmed}" vào CNH đang chọn`, 'info')
                    } catch (mapErr) {
                        console.error('Lỗi tự động ánh xạ sở thích:', mapErr)
                    }
                }
            } else {
                const updatedInterest = await updateInterest(editingId, { specializationId: targetSpec, label: trimmed })
                if (form.isActive !== undefined) {
                    await updateInterestStatus(editingId, Boolean(form.isActive))
                }
                const mappedUpdated = {
                    ...updatedInterest,
                    isActive: form.isActive !== false,
                    updatedAt: updatedInterest.updatedAt
                        ? new Date(updatedInterest.updatedAt).toLocaleDateString('vi-VN')
                        : new Date().toLocaleDateString('vi-VN')
                }
                setInterests(prev => prev.map(it => it.id === editingId ? mappedUpdated : it))
                showToast(`Đã lưu thay đổi cho "${trimmed}"`)
            }
            closeForm()
        } catch (err) {
            console.error('Không lưu được sở thích:', err)
            // BR-10 trả message tiếng Anh -> map sang tiếng Việt (DEF_58)
            const raw = err.response?.data?.message || ''
            const friendly = /already exists|duplicate|same label|case-insensitive/i.test(raw)
                ? 'Tên sở thích này đã tồn tại (không phân biệt hoa/thường) trong chuyên ngành đích. Hãy dùng tên khác.'
                : (LOOKS_VI.test(raw) ? raw : 'Có lỗi xảy ra khi lưu sở thích')
            showToast(friendly, 'error')
        } finally {
            setSaving(false)
        }
    }

    /* UC-40 — đổi trạng thái trực tiếp, luôn là tắt mềm (BR-09) */
    const handleStatusChange = async (item, nextValue) => {
        const isActive = nextValue === 'active'
        try {
            await updateInterestStatus(item.id, isActive)
            // Đổi trạng thái cũng là một lần cập nhật -> cột "Cập nhật" phải đổi theo (DEF_62)
            setInterests(prev => prev.map((it) => (
                it.id === item.id
                    ? { ...it, isActive, updatedAt: new Date().toLocaleDateString('vi-VN') }
                    : it
            )))
            showToast(`Đã ${isActive ? 'bật lại' : 'tắt'} sở thích "${item.label}"`, isActive ? 'success' : 'info')
        } catch (err) {
            console.error('Không đổi được trạng thái:', err)
            showToast('Không đổi được trạng thái sở thích', 'error')
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
        const nsData = await getNarrowSpecsBySpecialization(sid).catch(() => [])
        setFormNarrowSpecs(nsData || [])
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

    const activeCount = interests.filter(it => it.isActive).length

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="ci-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><Heart size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Sở thích nghề nghiệp</h1>
                            <p className="cm-page-sub">
                                Kho sở thích theo từng chuyên ngành, dùng cho sinh viên khai báo và cho ma trận ánh xạ
                            </p>
                        </div>
                    </div>
                    <div className="cm-page-head-actions">
                        <span className="cm-tag cm-tag--green">{activeCount} đang dùng</span>
                        <span className="cm-tag cm-tag--neutral">{interests.length} tổng cộng</span>
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

                <div className="ci-layout">
                    <div className="ci-main">
                        <div className="ci-card ci-toolbar">
                            <div className="ci-search-box">
                                <Search size={14} strokeWidth={2.4} className="ci-search-icon" />
                                <input
                                    type="text"
                                    className="ci-search"
                                    placeholder="Tìm sở thích theo tên..."
                                    value={query}
                                    onChange={(e) => { setQuery(e.target.value); setCurrentPage(1) }}
                                />
                            </div>

                            <div className="ci-filter-group">
                                {STATUS_FILTERS.map((f) => (
                                    <button
                                        key={f.key}
                                        type="button"
                                        className={`ci-chip${statusFilter === f.key ? ' is-active' : ''}`}
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

                            <button 
                                type="button" 
                                className="cm-btn cm-btn--primary" 
                                onClick={openCreate}
                            >
                                <Plus size={15} strokeWidth={2.6} /> Thêm sở thích
                            </button>
                        </div>

                        <div className="ci-card ci-table-card">
                            <div className="ci-table-wrap">
                                <table className="ci-table">
                                    <thead>
                                        <tr>
                                            <th>Tên sở thích</th>
                                            {viewAllCatalog && <th>Chuyên ngành</th>}
                                            <th>Trạng thái</th>
                                            <th>Cập nhật</th>
                                            <th className="ci-th-center" style={{ width: '100px' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedInterests.map((it) => (
                                            <tr key={it.id} className={!it.isActive ? 'ci-row-inactive' : ''}>
                                                <td className="ci-name-cell">{it.label}</td>
                                                {viewAllCatalog && <td className="ci-muted">{it.specName || '—'}</td>}
                                                <td>
                                                    <CmSelect
                                                        options={STATUS_OPTIONS}
                                                        value={it.isActive ? 'active' : 'inactive'}
                                                        onChange={(value) => handleStatusChange(it, value)}
                                                        size="sm"
                                                        tinted
                                                        searchable={false}
                                                        width="140px"
                                                    />
                                                </td>
                                                <td className="ci-muted">{it.updatedAt}</td>
                                                <td className="ci-td-center">
                                                    <button
                                                        type="button"
                                                        className="cm-btn cm-btn--secondary cm-btn--sm"
                                                        onClick={() => openEdit(it)}
                                                        title={`Sửa sở thích "${it.label}"`}
                                                    >
                                                        <Pencil size={13} strokeWidth={2.4} /> Sửa
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={viewAllCatalog ? 5 : 4} className="ci-empty">
                                                    Không tìm thấy sở thích nào phù hợp
                                                </td>
                                            </tr>
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
                                    itemLabel="sở thích"
                                />
                            )}
                        </div>
                    </div>

                    {/* ── Biểu mẫu tạo / sửa ── */}
                    <aside className="ci-card ci-form-panel">
                        <form onSubmit={handleSubmit} className="ci-form">
                            <div className="ci-form-head">
                                <h2 className="ci-form-title">
                                    {formMode === 'create' ? 'Thêm sở thích mới' : 'Chỉnh sửa sở thích'}
                                </h2>
                                {formMode === 'edit' && (
                                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={closeForm}>
                                        <Plus size={13} strokeWidth={2.6} /> Thêm mới
                                    </button>
                                )}
                            </div>

                            <div className="ci-field">
                                <label className="ci-label" htmlFor="ci-label-input">
                                    Tên sở thích <span className="ci-required">*</span>
                                </label>
                                <input
                                    id="ci-label-input"
                                    type="text"
                                    className="ci-input"
                                    value={form.label}
                                    maxLength={LABEL_MAX}
                                    onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))}
                                    placeholder="Ví dụ: Phát triển ứng dụng di động"
                                />
                            </div>

                            <div className="ci-field">
                                <span className="ci-label">Trạng thái</span>
                                <CmSelect
                                    options={STATUS_OPTIONS}
                                    value={form.isActive ? 'active' : 'inactive'}
                                    onChange={(value) => setForm(p => ({ ...p, isActive: value === 'active' }))}
                                    tinted
                                    searchable={false}
                                />
                            </div>

                            <div className="ci-field">
                                <span className="ci-label">Ngành học <span className="ci-required">*</span></span>
                                <CmSelect
                                    options={majorOptions}
                                    value={form.targetMajorId || ''}
                                    onChange={handleFormMajorChange}
                                    placeholder="Chọn ngành học"
                                />
                            </div>

                            <div className="ci-field">
                                <span className="ci-label">Chuyên ngành <span className="ci-required">*</span></span>
                                <CmSelect
                                    options={formSpecOptions}
                                    value={form.targetSpecId || ''}
                                    onChange={handleFormSpecChange}
                                    placeholder="Chọn chuyên ngành"
                                />
                            </div>

                            {formNarrowSpecs.length > 0 && (
                                <div className="ci-field">
                                    <span className="ci-label">Chuyên ngành hẹp (không bắt buộc)</span>
                                    <CmSelect
                                        options={formNsOptions}
                                        value={form.targetNsId || ''}
                                        onChange={(value) => setForm(p => ({ ...p, targetNsId: value }))}
                                        placeholder="Không gắn chuyên ngành hẹp"
                                    />
                                </div>
                            )}

                            <div className="ci-form-actions">
                                <button type="button" className="cm-btn cm-btn--secondary ci-btn-half" onClick={closeForm}>
                                    <XCircle size={14} strokeWidth={2.4} /> Hủy
                                </button>
                                <button type="submit" className="cm-btn cm-btn--primary ci-btn-half" disabled={saving}>
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
