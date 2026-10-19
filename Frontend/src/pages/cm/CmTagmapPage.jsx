import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Check, Plus, X, Trash2, Network, GitBranch, Search, Wrench, Heart, BookOpen, RefreshCw } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmCatalogFilter from '../../components/cm/CmCatalogFilter'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization } from '../../services/catalogService'
import { getSpecializationSkills } from '../../services/skillService'
import { getSpecializationInterests } from '../../services/interestService'
import { getTagMap, updateTagMap, getTagMapSuggestions, syncTagMapFromCourses } from '../../services/tagMapService'
import './CmTagmapPage.css'

const emptyForm = { sourceType: 'SKILL', sourceId: '', mappingType: 'SHARED', weight: '1.0' }

const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 10.0
const WEIGHT_DEFAULT = 1.0

/* Phân loại ánh xạ. Giữ lại từ tiếng Anh trong ngoặc vì đó là giá trị lưu trong
   cơ sở dữ liệu, CM có thể phải đối chiếu khi tra cứu. */
const MAPPING_TYPES = [
    { value: 'DIRECT', label: 'Đặc thù (DIRECT)', tone: 'green' },
    { value: 'SHARED', label: 'Dùng chung (SHARED)', tone: 'orange' },
]

const MAPPING_LABEL = {
    DIRECT: 'Đặc thù',
    SHARED: 'Dùng chung',
}

export default function CmTagMapPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const username = localStorage.getItem('username') || 'Content Manager'
    const { toasts, showToast, dismissToast } = useCmToast()

    const targetMajorId = location.state?.majorId || searchParams.get('majorId') || ''
    const targetSpecId = location.state?.specId || searchParams.get('specId') || ''
    const targetNsId = location.state?.nsId || location.state?.selectedNsId || searchParams.get('nsId') || searchParams.get('selectedNsId') || ''

    const [majors, setMajors] = useState([])
    const [specializations, setSpecializations] = useState([])
    const [narrowSpecs, setNarrowSpecs] = useState([])

    const [majorId, setMajorId] = useState(targetMajorId)
    const [specId, setSpecId] = useState(targetSpecId)
    const [selectedNsId, setSelectedNsId] = useState(targetNsId)

    const [specSkills, setSpecSkills] = useState([])
    const [specInterests, setSpecInterests] = useState([])

    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(false)
    const [entriesError, setEntriesError] = useState(null)
    const [pendingWeights, setPendingWeights] = useState({})
    const [removeTarget, setRemoveTarget] = useState(null)
    const [saving, setSaving] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [syncing, setSyncing] = useState(false)

    const [optionSearchQuery, setOptionSearchQuery] = useState('')
    const [form, setForm] = useState(emptyForm)

    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    /* 1. Danh sách ngành */
    useEffect(() => {
        getMajors()
            .then((data) => setMajors((data || []).filter((m) => m.isActive)))
            .catch((err) => console.error('Không tải được danh sách ngành:', err))
    }, [])

    /* 2. Chuyên ngành theo ngành đang chọn */
    useEffect(() => {
        if (!majorId) return
        getSpecializationsByMajor(majorId)
            .then((data) => {
                const active = (data || []).filter((s) => s.isActive)
                setSpecializations(active)
                if (targetSpecId && active.some(s => s.id === targetSpecId)) setSpecId(targetSpecId)
            })
            .catch((err) => console.error('Không tải được danh sách chuyên ngành:', err))
    }, [majorId, targetSpecId])

    /* 3. Chuyên ngành hẹp + kho kỹ năng / sở thích của chuyên ngành */
    useEffect(() => {
        if (!specId) return

        getNarrowSpecsBySpecialization(specId)
            .then((data) => {
                const nsList = data || []
                setNarrowSpecs(nsList)
                if (targetNsId && nsList.some(n => n.id === targetNsId)) setSelectedNsId(targetNsId)
            })
            .catch((err) => console.error('Không tải được danh sách chuyên ngành hẹp:', err))

        getSpecializationSkills(specId)
            .then((data) => setSpecSkills((data || []).filter((s) => s.isActive)))
            .catch((err) => console.error('Không tải được danh sách kỹ năng:', err))

        getSpecializationInterests(specId)
            .then((data) => setSpecInterests((data || []).filter((i) => i.isActive)))
            .catch((err) => console.error('Không tải được danh sách sở thích:', err))
    }, [specId, targetNsId])

    /* 4. Ánh xạ của chuyên ngành hẹp đang chọn */
    useEffect(() => {
        if (!selectedNsId) return
        let alive = true
        // Deep link vào thẳng màn cũng phải thấy trạng thái đang tải (DEF_65)
        setLoading(true)
        setEntriesError(null)
        getTagMap(selectedNsId)
            .then((data) => { if (alive) { setEntries(data || []); setEntriesError(null) } })
            .catch((err) => {
                console.error('Không tải được ánh xạ:', err)
                // Lỗi tải khác hẳn "chưa có ánh xạ nào" (DEF_67)
                if (alive) {
                    setEntries([])
                    setEntriesError(err.response?.data?.message || 'Không tải được danh sách ánh xạ của chuyên ngành hẹp này.')
                }
            })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [selectedNsId])

    /* 5. Kỹ năng suy ra từ môn học của CNH mà ánh xạ còn thiếu — gồm cả kỹ năng của
       môn tiên quyết (thuộc chuyên ngành) của các môn trong combo. Tính lại sau mỗi
       lần ánh xạ đổi để danh sách gợi ý không hiện mục vừa thêm. */
    useEffect(() => {
        // Không xoá gợi ý ở đây: các handler đổi Ngành/CN/CNH đã dọn sẵn state.
        if (!selectedNsId) return
        let alive = true
        getTagMapSuggestions(selectedNsId)
            .then((data) => { if (alive) setSuggestions(data || []) })
            .catch((err) => {
                console.error('Không tải được gợi ý ánh xạ từ môn học:', err)
                if (alive) setSuggestions([])
            })
        return () => { alive = false }
    }, [selectedNsId, entries])

    /* Đổi cấp nào thì dọn luôn dữ liệu của các cấp dưới ngay trong handler —
       để effect chỉ còn việc tải dữ liệu, không phải dọn state. */
    const handleMajorChange = (value) => {
        setMajorId(value)
        setSpecId('')
        setSelectedNsId('')
        setSpecializations([])
        setNarrowSpecs([])
        setSpecSkills([])
        setSpecInterests([])
        setEntries([])
        setSuggestions([])
        setCurrentPage(1)
    }

    const handleSpecChange = (value) => {
        setSpecId(value)
        setSelectedNsId('')
        setNarrowSpecs([])
        setSpecSkills([])
        setSpecInterests([])
        setEntries([])
        setSuggestions([])
        setCurrentPage(1)
    }

    const handleNsChange = (value) => {
        setSelectedNsId(value)
        setEntries([])
        setSuggestions([])
        setLoading(Boolean(value))
        setCurrentPage(1)
    }

    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize))
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return entries.slice(start, start + pageSize)
    }, [entries, currentPage, pageSize])

    /* Kỹ năng / sở thích chưa được ánh xạ, lọc theo từ khoá tìm kiếm */
    const availableOptions = useMemo(() => {
        const mappedIds = new Set(entries.filter((e) => e.sourceType === form.sourceType).map((e) => e.sourceId))
        const list = form.sourceType === 'SKILL'
            ? specSkills.filter((s) => !mappedIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }))
            : specInterests.filter((i) => !mappedIds.has(i.id)).map((i) => ({ id: i.id, name: i.label }))

        const q = optionSearchQuery.trim().toLowerCase()
        return q ? list.filter((item) => item.name.toLowerCase().includes(q)) : list
    }, [entries, form.sourceType, specSkills, specInterests, optionSearchQuery])

    // Tổng số mục trong danh mục gốc theo loại đang chọn — để phân biệt "danh mục rỗng"
    // với "đã ánh xạ hết" (DEF_64)
    const totalOptionsForKind = form.sourceType === 'SKILL' ? specSkills.length : specInterests.length

    const saveTagMapToBackend = async (newEntriesList, successMessage) => {
        if (!selectedNsId) return
        setSaving(true)
        try {
            const payload = newEntriesList.map((e) => ({
                sourceType: e.sourceType,
                sourceId: e.sourceId,
                mappingType: e.mappingType,
                weight: Number.isFinite(parseFloat(e.weight)) ? parseFloat(e.weight) : WEIGHT_DEFAULT,
            }))
            const updated = await updateTagMap(selectedNsId, payload)
            setEntries(updated || [])
            if (successMessage) showToast(successMessage)
        } catch (err) {
            console.error('Không cập nhật được ánh xạ:', err)
            showToast(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật ánh xạ', 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleAdd = (e) => {
        e.preventDefault()
        const kindLabel = form.sourceType === 'SKILL' ? 'kỹ năng' : 'sở thích'

        if (!form.sourceId) {
            showToast(`Vui lòng chọn một ${kindLabel} để thêm vào ánh xạ`, 'warning')
            return
        }
        const weightNum = parseFloat(form.weight)
        if (Number.isNaN(weightNum) || weightNum < WEIGHT_MIN || weightNum > WEIGHT_MAX) {
            showToast(`Trọng số phải nằm trong khoảng ${WEIGHT_MIN} đến ${WEIGHT_MAX}`, 'warning')
            return
        }

        const newEntry = {
            sourceType: form.sourceType,
            sourceId: form.sourceId,
            mappingType: form.mappingType,
            weight: weightNum,
        }
        saveTagMapToBackend([...entries, newEntry], `Đã thêm ${kindLabel} vào ánh xạ`)
        setForm((prev) => ({ ...prev, sourceId: '' }))
        setOptionSearchQuery('')
    }

    const updateEntry = (entryId, field, value) => {
        saveTagMapToBackend(
            entries.map((e) => (e.id === entryId ? { ...e, [field]: value } : e)),
            'Đã cập nhật ánh xạ'
        )
    }

    // Xoá ánh xạ là thao tác không hoàn tác được -> phải xác nhận trước (DEF_66)
    const removeEntry = (entry) => {
        if (entries.length <= 1) return // Mỗi chuyên ngành hẹp phải còn ít nhất một ánh xạ
        setRemoveTarget(entry)
    }

    const confirmRemoveEntry = () => {
        const entry = removeTarget
        setRemoveTarget(null)
        if (!entry) return
        saveTagMapToBackend(
            entries.filter((e) => e.id !== entry.id),
            `Đã gỡ "${entry.sourceName || entry.name || 'ánh xạ'}" khỏi danh sách`
        )
    }

    // Chỉ lưu khi rời ô, và từ chối giá trị rỗng/ngoài khoảng thay vì âm thầm ghi 1.0 (DEF_68/DEF_69)
    const commitWeight = (entry) => {
        const raw = pendingWeights[entry.id]
        setPendingWeights((p) => { const next = { ...p }; delete next[entry.id]; return next })
        if (raw === undefined) return
        const num = parseFloat(raw)
        if (raw === '' || Number.isNaN(num)) {
            showToast('Trọng số không được để trống. Giữ nguyên giá trị cũ.', 'warning')
            return
        }
        if (num < WEIGHT_MIN || num > WEIGHT_MAX) {
            showToast(`Trọng số phải nằm trong khoảng ${WEIGHT_MIN} đến ${WEIGHT_MAX}. Giữ nguyên giá trị cũ.`, 'warning')
            return
        }
        if (num === Number(entry.weight)) return
        updateEntry(entry.id, 'weight', num)
    }

    /* Dùng endpoint sync (POST) chứ không phải PUT tag-map: sync chỉ CHÈN mục còn
       thiếu, giữ nguyên trọng số và phân loại mà CM đã chỉnh tay. */
    const handleSyncFromCourses = async () => {
        if (!selectedNsId || suggestions.length === 0) return
        setSyncing(true)
        try {
            const result = await syncTagMapFromCourses(selectedNsId)
            setEntries(result.entries || [])
            const added = result.addedCount ?? (result.added?.length || 0)
            showToast(added > 0
                ? `Đã thêm ${added} kỹ năng từ môn học vào ánh xạ`
                : 'Ánh xạ đã đầy đủ, không có kỹ năng nào cần thêm')
        } catch (err) {
            console.error('Không đồng bộ được ánh xạ từ môn học:', err)
            showToast(err.response?.data?.message || 'Có lỗi xảy ra khi đồng bộ từ môn học', 'error')
        } finally {
            setSyncing(false)
        }
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const selectedNsName = narrowSpecs.find((n) => n.id === selectedNsId)?.name || ''

    const selectedOption = useMemo(() => {
        if (!form.sourceId) return null
        if (form.sourceType === 'SKILL') {
            const s = specSkills.find(x => x.id === form.sourceId)
            return s ? { id: s.id, name: s.name } : null
        }
        const i = specInterests.find(x => x.id === form.sourceId)
        return i ? { id: i.id, name: i.label } : null
    }, [form.sourceId, form.sourceType, specSkills, specInterests])

    const skillCount = entries.filter(e => e.sourceType === 'SKILL').length
    const interestCount = entries.filter(e => e.sourceType === 'INTEREST').length
    const kindNoun = form.sourceType === 'SKILL' ? 'kỹ năng' : 'sở thích'

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="tm-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><GitBranch size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Ánh xạ Kỹ năng &amp; Sở thích</h1>
                            <p className="cm-page-sub">
                                Gán kỹ năng và sở thích cho từng chuyên ngành hẹp, làm đầu vào cho bộ tính điểm phù hợp
                            </p>
                        </div>
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

                <div className="tm-layout">
                    {/* ── Danh sách ánh xạ hiện có ── */}
                    <section className="tm-card tm-entries">
                        <div className="tm-entries-head">
                            <div className="tm-entries-titles">
                                <h2 className="tm-panel-title">
                                    {selectedNsName || 'Chưa chọn chuyên ngành hẹp'}
                                </h2>
                                <p className="tm-legend">
                                    <span className="cm-tag cm-tag--green">Đặc thù</span>
                                    <span className="tm-legend-text">riêng của chuyên ngành hẹp này</span>
                                    <span className="cm-tag cm-tag--orange">Dùng chung</span>
                                    <span className="tm-legend-text">dùng chung với chuyên ngành hẹp khác</span>
                                </p>
                            </div>

                            {selectedNsId && (
                                <div className="tm-entry-stats">
                                    <span className="cm-tag cm-tag--blue">
                                        <Wrench size={11} strokeWidth={2.4} /> {skillCount} kỹ năng
                                    </span>
                                    <span className="cm-tag cm-tag--purple">
                                        <Heart size={11} strokeWidth={2.4} /> {interestCount} sở thích
                                    </span>
                                </div>
                            )}
                        </div>

                        {selectedNsId && suggestions.length > 0 && (
                            <div className="tm-suggest">
                                <div className="tm-suggest-head">
                                    <span className="tm-suggest-title">
                                        <BookOpen size={14} strokeWidth={2.4} />
                                        {suggestions.length} kỹ năng từ môn học của chuyên ngành hẹp này chưa được ánh xạ
                                    </span>
                                    <button
                                        type="button"
                                        className="cm-btn cm-btn--primary cm-btn--sm"
                                        disabled={syncing || saving}
                                        onClick={handleSyncFromCourses}
                                    >
                                        <RefreshCw size={13} strokeWidth={2.6} />
                                        {syncing ? 'Đang thêm...' : 'Thêm tất cả'}
                                    </button>
                                </div>
                                <ul className="tm-suggest-list">
                                    {suggestions.map((s) => (
                                        <li key={s.sourceId} className="tm-suggest-item">
                                            <span className="tm-suggest-name">{s.sourceName}</span>
                                            <span className={`cm-tag cm-tag--${s.fromPrerequisite ? 'orange' : 'green'}`}>
                                                {s.fromPrerequisite ? 'Dùng chung' : 'Đặc thù'}
                                            </span>
                                            <span className="tm-suggest-reason">{s.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="tm-hint">
                                    Thêm tất cả chỉ chèn các mục còn thiếu với trọng số 1.0 — trọng số và phân loại
                                    bạn đã chỉnh tay không bị ghi đè.
                                </p>
                            </div>
                        )}

                        {loading ? (
                            <p className="tm-placeholder">Đang tải dữ liệu ánh xạ...</p>
                        ) : entriesError ? (
                            <p className="tm-placeholder" style={{ color: '#B91C1C' }}>
                                {entriesError} Đây là lỗi tải dữ liệu, không phải chuyên ngành hẹp chưa có ánh xạ nào.{' '}
                                <button type="button" className="tm-link-btn" onClick={() => setSelectedNsId((v) => v)}>
                                    Chọn lại chuyên ngành hẹp để tải lại
                                </button>
                            </p>
                        ) : (
                            <div className="tm-table-wrap">
                                <table className="tm-table">
                                    <thead>
                                        <tr>
                                            <th>Nguồn</th>
                                            <th>Tên</th>
                                            <th>Phân loại</th>
                                            <th>Trọng số</th>
                                            <th className="tm-th-center" style={{ width: '90px' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedEntries.map((entry) => (
                                            <tr key={entry.id || `${entry.sourceType}-${entry.sourceId}`}>
                                                <td>
                                                    <span className={`cm-tag cm-tag--${entry.sourceType === 'SKILL' ? 'blue' : 'purple'}`}>
                                                        {entry.sourceType === 'SKILL'
                                                            ? <><Wrench size={11} strokeWidth={2.4} /> Kỹ năng</>
                                                            : <><Heart size={11} strokeWidth={2.4} /> Sở thích</>}
                                                    </span>
                                                </td>
                                                <td className="tm-entry-name">{entry.sourceName || entry.name || '—'}</td>
                                                <td>
                                                    <CmSelect
                                                        options={MAPPING_TYPES}
                                                        value={entry.mappingType || 'SHARED'}
                                                        onChange={(value) => updateEntry(entry.id, 'mappingType', value)}
                                                        disabled={saving}
                                                        size="sm"
                                                        tinted
                                                        searchable={false}
                                                        width="164px"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min={WEIGHT_MIN}
                                                        max={WEIGHT_MAX}
                                                        step="0.1"
                                                        className="tm-weight-input"
                                                        value={pendingWeights[entry.id] ?? entry.weight}
                                                        disabled={saving}
                                                        onChange={(e) => setPendingWeights((p) => ({ ...p, [entry.id]: e.target.value }))}
                                                        onBlur={() => commitWeight(entry)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                                    />
                                                </td>
                                                <td className="tm-td-center">
                                                    <button
                                                        type="button"
                                                        className="cm-btn-icon cm-btn-icon--danger"
                                                        disabled={entries.length <= 1 || saving}
                                                        title={entries.length <= 1
                                                            ? 'Mỗi chuyên ngành hẹp phải giữ ít nhất một ánh xạ'
                                                            : 'Gỡ ánh xạ này'}
                                                        onClick={() => removeEntry(entry)}
                                                    >
                                                        <Trash2 size={14} strokeWidth={2.2} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {entries.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="tm-empty-cell">
                                                    {selectedNsId
                                                        ? 'Chuyên ngành hẹp này chưa có ánh xạ nào'
                                                        : 'Chọn một chuyên ngành hẹp ở thanh lọc phía trên để bắt đầu'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {entries.length > 0 && (
                            <CmPagination
                                page={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                totalItems={entries.length}
                                pageSize={pageSize}
                                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1) }}
                                itemLabel="ánh xạ"
                            />
                        )}
                    </section>

                    {/* ── Thêm ánh xạ mới ── */}
                    <aside className="tm-card tm-form-panel">
                        <h2 className="tm-panel-title">Thêm ánh xạ mới</h2>

                        <form onSubmit={handleAdd} className="tm-form">
                            <div className="tm-add-field">
                                <span className="tm-add-label">Nguồn ánh xạ</span>
                                <div className="tm-type-toggle">
                                    <button
                                        type="button"
                                        className={`tm-type-opt${form.sourceType === 'SKILL' ? ' is-on' : ''}`}
                                        onClick={() => {
                                            setForm((p) => ({ ...p, sourceType: 'SKILL', sourceId: '' }))
                                            setOptionSearchQuery('')
                                        }}
                                    >
                                        <Wrench size={13} strokeWidth={2.4} /> Kỹ năng
                                    </button>
                                    <button
                                        type="button"
                                        className={`tm-type-opt${form.sourceType === 'INTEREST' ? ' is-on' : ''}`}
                                        onClick={() => {
                                            setForm((p) => ({ ...p, sourceType: 'INTEREST', sourceId: '' }))
                                            setOptionSearchQuery('')
                                        }}
                                    >
                                        <Heart size={13} strokeWidth={2.4} /> Sở thích
                                    </button>
                                </div>
                            </div>

                            <div className="tm-add-field">
                                <span className="tm-add-label">Chọn {kindNoun}</span>

                                {selectedOption && (
                                    <div className="tm-picked">
                                        <Check size={13} strokeWidth={3} />
                                        <span className="tm-picked-name">{selectedOption.name}</span>
                                        <button
                                            type="button"
                                            className="tm-picked-clear"
                                            onClick={() => setForm(p => ({ ...p, sourceId: '' }))}
                                            aria-label="Bỏ chọn"
                                        >
                                            <X size={13} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}

                                <div className="tm-search-box">
                                    <Search size={14} strokeWidth={2.4} className="tm-search-icon" />
                                    <input
                                        type="text"
                                        className="tm-search-input"
                                        placeholder={`Tìm ${kindNoun} theo tên...`}
                                        value={optionSearchQuery}
                                        onChange={(e) => setOptionSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="tm-option-list">
                                    {availableOptions.map((o) => {
                                        const isSelected = form.sourceId === o.id
                                        return (
                                            <button
                                                type="button"
                                                key={o.id}
                                                className={`tm-option${isSelected ? ' is-selected' : ''}`}
                                                onClick={() => setForm((p) => ({ ...p, sourceId: o.id }))}
                                            >
                                                <span className="tm-option-name">{o.name}</span>
                                                <span className="tm-option-cue">
                                                    {isSelected
                                                        ? <><Check size={11} strokeWidth={3} /> Đã chọn</>
                                                        : <><Plus size={11} strokeWidth={3} /> Chọn</>}
                                                </span>
                                            </button>
                                        )
                                    })}
                                    {availableOptions.length === 0 && (
                                        <div className="tm-option-empty">
                                            {optionSearchQuery
                                                ? 'Không tìm thấy kết quả phù hợp'
                                                : totalOptionsForKind === 0
                                                    /* Danh mục gốc rỗng khác hẳn "đã ánh xạ hết" (DEF_64) */
                                                    ? `Chuyên ngành này chưa có ${kindNoun} nào trong danh mục để ánh xạ`
                                                    : `Mọi ${kindNoun} của chuyên ngành này đều đã được ánh xạ`}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="tm-add-field">
                                <span className="tm-add-label">Phân loại ánh xạ</span>
                                <CmSelect
                                    options={MAPPING_TYPES}
                                    value={form.mappingType}
                                    onChange={(value) => setForm((p) => ({ ...p, mappingType: value }))}
                                    tinted
                                    searchable={false}
                                />
                                <p className="tm-hint">
                                    {MAPPING_LABEL[form.mappingType] === 'Đặc thù'
                                        ? 'Chỉ đặc trưng cho chuyên ngành hẹp này'
                                        : 'Dùng chung với các chuyên ngành hẹp khác trong cùng ngành'}
                                </p>
                            </div>

                            <div className="tm-add-field">
                                <span className="tm-add-label">Trọng số (từ {WEIGHT_MIN} đến {WEIGHT_MAX})</span>
                                <input
                                    type="number"
                                    min={WEIGHT_MIN}
                                    max={WEIGHT_MAX}
                                    step="0.1"
                                    className="tm-input-num"
                                    value={form.weight}
                                    onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                                />
                            </div>

                            <button
                                type="submit"
                                className="cm-btn cm-btn--primary cm-btn--block"
                                disabled={saving || !form.sourceId || !selectedNsId}
                            >
                                <Plus size={15} strokeWidth={2.6} />
                                {saving ? 'Đang lưu...' : 'Thêm vào ánh xạ'}
                            </button>

                            {!selectedNsId && (
                                <p className="tm-hint tm-hint--warn">
                                    Cần chọn chuyên ngành hẹp trước khi thêm ánh xạ
                                </p>
                            )}
                        </form>
                    </aside>
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        
            {removeTarget && (
                <div className="tm-modal-overlay" onClick={() => setRemoveTarget(null)}>
                    <div className="tm-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
                        <h3 className="tm-modal-title">Gỡ ánh xạ này?</h3>
                        <p className="tm-modal-text">
                            "{removeTarget.sourceName || removeTarget.name || 'Ánh xạ'}" sẽ bị gỡ khỏi chuyên ngành hẹp
                            đang chọn. Thao tác này ảnh hưởng tới điểm gợi ý và không hoàn tác được.
                        </p>
                        <div className="tm-modal-actions">
                            <button type="button" className="cm-btn cm-btn--ghost" onClick={() => setRemoveTarget(null)}>Không gỡ</button>
                            <button type="button" className="cm-btn cm-btn--danger" onClick={confirmRemoveEntry}>Xác nhận gỡ</button>
                        </div>
                    </div>
                </div>
            )}
</Layout>
    )
}
