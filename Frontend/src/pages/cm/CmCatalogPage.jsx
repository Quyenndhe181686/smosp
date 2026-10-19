import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import { ChevronRight, Plus, X, Hexagon, Save, Trash2, Search, Folder } from 'lucide-react'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './CmCatalogPage.css'

// BE giới hạn mã 50 ký tự — 51 ký tự trả 500 thô (DEF_92)
const CODE_MAX = 50

import {
    getMajors,
    getSpecializationsByMajor,
    getNarrowSpecsBySpecialization,
    getNarrowSpecDetail,
    createMajor,
    updateMajor,
    updateMajorStatus,
    createSpecialization,
    updateSpecialization,
    updateSpecializationStatus,
    createNarrowSpec,
    updateNarrowSpec,
    publishNarrowSpec,
    uploadMajorImage,
    uploadSpecializationImage
} from '../../services/catalogService'

/* ── Checklist helper ── */
function getChecklist(ns, specIsActive) {
    const courseCount = ns?.courses ?? 0;
    const skillCount = ns?.skills ?? 0;
    const interestCount = ns?.interests ?? 0;
    const twConfig = ns?.tw ?? true;
    return [
        { ok: Boolean(specIsActive), label: 'Chuyên ngành cha đang hoạt động', val: specIsActive ? 'Đã bật' : 'Đang tắt' },
        { ok: courseCount >= 5, label: 'Môn chuyên sâu (5–10)', val: `${courseCount} môn` },
        { ok: skillCount > 0, label: 'Đã ánh xạ kỹ năng', val: skillCount > 0 ? `${skillCount} kỹ năng` : 'Chưa có' },
        { ok: interestCount > 0, label: 'Đã ánh xạ sở thích', val: interestCount > 0 ? `${interestCount} sở thích` : 'Chưa có' },
        { ok: twConfig !== null && twConfig !== false, label: 'Đã cấu hình trọng số điểm phù hợp', val: twConfig ? 'Tự động' : 'Chưa thiết lập' },
    ]
}

/* ── Right panel modes ── */
const PANEL = { EMPTY: 'EMPTY', EDIT_MAJOR: 'EDIT_MAJOR', EDIT_SPEC: 'EDIT_SPEC', EDIT_NS: 'EDIT_NS', ADD_NS: 'ADD_NS', ADD_SPEC: 'ADD_SPEC', ADD_MAJOR: 'ADD_MAJOR' }

export default function CmCatalogPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const username = localStorage.getItem('username') || 'Content Manager'
    const { toasts, showToast, dismissToast } = useCmToast()

    /* Tree expand state */
    const [expandedMajors, setExpandedMajors] = useState({})
    const [expandedSpecs, setExpandedSpecs] = useState({})

    /* Selected node */
    const [selectedNS, setSelectedNS] = useState(null)
    const [selectedSpecDetail, setSelectedSpecDetail] = useState(null)
    const [selectedMajor, setSelectedMajor] = useState(null)

    /* Panel mode */
    const [panel, setPanel] = useState(PANEL.EMPTY)

    /* Filters */
    const [filterMajor, setFilterMajor] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [search, setSearch] = useState(location.state?.search || '')

    /* Form state for add/edit */
    const [form, setForm] = useState({ name: '', code: '', parentId: '', description: '' })
    const [selectedFile, setSelectedFile] = useState(null)

    /* Status dropdown on detail panel */
    const [nsStatus, setNsStatus] = useState('draft') // 'published' | 'draft' | 'hidden'

    /* Tree data loaded dynamically from Backend */
    const [treeData, setTreeData] = useState([])
    const [loading, setLoading] = useState(true)

    const tree = treeData

    const [treeError, setTreeError] = useState(null)

    const loadTreeData = async () => {
        try {
            setLoading(true);
            const majors = await getMajors();
            const assembledTree = await Promise.all(majors.map(async (major) => {
                const specializations = await getSpecializationsByMajor(major.id);
                const specsWithNS = await Promise.all(specializations.map(async (spec) => {
                    const narrowSpecs = await getNarrowSpecsBySpecialization(spec.id);
                    return {
                        id: spec.id,
                        code: spec.code,
                        name: spec.name,
                        isActive: spec.isActive,
                        imageUrl: spec.imageUrl,
                        narrowSpecs: narrowSpecs.map(ns => ({
                            id: ns.id,
                            code: ns.code,
                            name: ns.name,
                            isPublished: ns.isPublished,
                            publishedAt: ns.publishedAt ? new Date(ns.publishedAt).toLocaleDateString() : null,
                            courses: 0,
                            tw: null,
                            skills: 0,
                            interests: 0
                        }))
                    };
                }));
                return {
                    id: major.id,
                    code: major.code,
                    name: major.name,
                    description: major.description,
                    isActive: major.isActive,
                    imageUrl: major.imageUrl,
                    specializations: specsWithNS.map(s => ({
                        ...s,
                        description: specializations.find(sp => sp.id === s.id)?.description
                    }))
                };
            }));
            
            // Auto expand first major and spec if any
            if (assembledTree.length > 0 && Object.keys(expandedMajors).length === 0) {
                 setExpandedMajors({ [assembledTree[0].id]: true });
                 if (assembledTree[0].specializations.length > 0) {
                     setExpandedSpecs({ [assembledTree[0].specializations[0].id]: true });
                 }
            }
            
            setTreeData(assembledTree);
            setTreeError(null);
            return assembledTree;
        } catch (error) {
            console.error("Failed to load catalog tree:", error);
            // Truoc day chi console.error nen UI hien nham "Khong co ket qua" (DEF_88)
            setTreeError(error.response?.data?.message || 'Không tải được cây danh mục từ hệ thống.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTreeData();
    }, []);

    useEffect(() => {
        if (location.state?.selectedId && treeData.length > 0) {
            const selId = location.state.selectedId;
            let found = false;
            for (const major of treeData) {
                if (major.id === selId) {
                    selectMajor(major);
                    found = true;
                    break;
                }
                for (const spec of major.specializations) {
                    if (spec.id === selId) {
                        setExpandedMajors(p => ({ ...p, [major.id]: true }));
                        selectSpec(spec, major);
                        found = true;
                        break;
                    }
                    for (const ns of spec.narrowSpecs) {
                        if (ns.id === selId) {
                            setExpandedMajors(p => ({ ...p, [major.id]: true }));
                            setExpandedSpecs(p => ({ ...p, [spec.id]: true }));
                            selectNS(ns, spec, major);
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
        }
    }, [location.state?.selectedId, treeData])

    /* ── Filter tree ── */
    const filteredTree = tree.filter(major => {
        if (filterMajor && major.id !== filterMajor) return false
        if (filterStatus === 'hidden' && major.isActive) return false
        if (filterStatus && filterStatus !== 'hidden' && !major.isActive) return false
        // Ô tìm kiếm phải khớp cả MÃ lẫn TÊN ở cả 3 cấp, không chỉ tên (DEF_89)
        const q = search.trim().toLowerCase()
        if (!q) return true
        const hit = (v) => !!v && String(v).toLowerCase().includes(q)
        const nameMatch = hit(major.name) || hit(major.code) || major.id === search
        const nsMatch = major.specializations.some(s =>
            hit(s.name) || hit(s.code) || s.id === search ||
            s.narrowSpecs.some(ns => hit(ns.name) || hit(ns.code) || ns.id === search)
        )
        return nameMatch || nsMatch
    })

    /* Danh sách CN hẹp thực sự hiển thị sau bộ lọc + tìm kiếm.
       - "Đang ẩn" trước đây luôn return false cho mọi CNH nên ẩn sạch cả cây con,
         kể cả khi Ngành cha đang tắt (DEF_90).
       - Tìm kiếm phải khớp cả mã (DEF_89). */
    function visibleNarrowSpecs(spec, major) {
        const q = search.trim().toLowerCase()
        return (spec.narrowSpecs || []).filter(ns => {
            if (filterStatus === 'published' && !ns.isPublished) return false
            if (filterStatus === 'draft' && ns.isPublished) return false
            if (filterStatus === 'hidden') {
                // "Đang ẩn" ở cấp CNH = CNH chưa công bố HOẶC cha (Ngành/Chuyên ngành) đang tắt
                const hiddenByParent = major?.isActive === false || spec?.isActive === false
                if (!hiddenByParent && ns.isPublished) return false
            }
            if (!q) return true
            return (
                (ns.name || '').toLowerCase().includes(q) ||
                (ns.code || '').toLowerCase().includes(q) ||
                ns.id === search
            )
        })
    }

    /* ── Handlers ── */
    function toggleMajor(id) {
        setExpandedMajors(p => ({ ...p, [id]: !p[id] }))
    }

    function toggleSpec(id) {
        setExpandedSpecs(p => ({ ...p, [id]: !p[id] }))
    }

    function selectMajor(major) {
        setSelectedMajor(major)
        setSelectedSpecDetail(null)
        setSelectedNS(null)
        setForm({
            name: major.name,
            code: major.code,
            parentId: '',
            description: major.description || '',
        })
        setSelectedFile(null)
        setPanel(PANEL.EDIT_MAJOR)
        setExpandedMajors(p => ({ ...p, [major.id]: true }))
    }

    function selectSpec(spec, major) {
        setSelectedSpecDetail({ spec, major })
        setSelectedMajor(null)
        setSelectedNS(null)
        setForm({
            name: spec.name,
            code: spec.code,
            parentId: major.id,
            description: spec.description || '',
        })
        setSelectedFile(null)
        setPanel(PANEL.EDIT_SPEC)
        setExpandedSpecs(p => ({ ...p, [spec.id]: true }))
    }

    async function selectNS(ns, spec, major) {
        try {
            const detail = await getNarrowSpecDetail(ns.id);
            const enrichedNS = {
                ...ns,
                courses: detail.courses ? detail.courses.length : (ns.courses || 0),
                skills: detail.skills?.length ?? detail.skillCount ?? (ns.skills || 0),
                interests: detail.interests?.length ?? detail.interestCount ?? (ns.interests || 0),
                tw: detail.hasWeightConfig ?? ns.tw ?? true,
                description: detail.description
            };
            setSelectedNS({ ns: enrichedNS, spec, major });
            setSelectedSpecDetail(null);
            setSelectedMajor(null);
            setNsStatus(detail.isPublished ? 'published' : 'draft');
            setForm({
                name: enrichedNS.name,
                code: enrichedNS.code,
                parentId: spec.id,
                description: enrichedNS.description || '',
            })
            setPanel(PANEL.EDIT_NS);
        } catch (err) {
            console.error("Error loading narrow spec detail:", err);
            setSelectedNS({ ns, spec, major });
            setSelectedSpecDetail(null);
            setSelectedMajor(null);
            setNsStatus(ns.isPublished ? 'published' : 'draft');
            setForm({
                name: ns.name,
                code: ns.code,
                parentId: spec.id,
                description: ns.description || '',
            })
            setPanel(PANEL.EDIT_NS);
        }
    }

    function openAddMajor() {
        setSelectedNS(null); setSelectedSpecDetail(null); setSelectedMajor(null);
        setForm({
            name: '',
            code: '',
            parentId: '',
            description: '',
        })
        setSelectedFile(null)
        setPanel(PANEL.ADD_MAJOR)
    }

    function openAddSpec(parentMajorId = '') {
        setSelectedNS(null); setSelectedSpecDetail(null); setSelectedMajor(null);
        setForm({ name: '', code: '', parentId: parentMajorId, description: '' })
        setSelectedFile(null)
        setPanel(PANEL.ADD_SPEC)
    }

    function openAddNS(parentSpecId = '') {
        setSelectedNS(null); setSelectedSpecDetail(null); setSelectedMajor(null);
        setForm({ name: '', code: '', parentId: parentSpecId, description: '' })
        setSelectedFile(null)
        setPanel(PANEL.ADD_NS)
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    /* ── Active filter tags ── */
    const activeTags = [
        filterMajor && { label: tree.find(m => m.id === filterMajor)?.name, clear: () => setFilterMajor('') },
        filterStatus && { label: { published: 'Đã công bố', draft: 'Bản nháp', hidden: 'Đang ẩn' }[filterStatus], clear: () => setFilterStatus('') },
    ].filter(Boolean)

    /* ── NS status options ── */
    const statusOptions = [
        { value: 'published', label: 'Đã công bố', tone: 'green' },
        { value: 'draft', label: 'Bản nháp', tone: 'orange' },
        { value: 'hidden', label: 'Đang ẩn', tone: 'gray' },
    ]

    /* Major / Specialization chỉ có bật–tắt, dùng chung tông với NS */
    const activeStatusOptions = [
        { value: 'published', label: 'Đang kích hoạt', tone: 'green' },
        { value: 'hidden', label: 'Đang ẩn', tone: 'gray' },
    ]

    /* ── Render right panel ── */
    function renderPanel() {
        /* EMPTY */
        if (panel === PANEL.EMPTY) return (
            <div className="cc-empty">
                <div className="cc-empty-icon"><Hexagon size={44} strokeWidth={1.4} /></div>
                <div className="cc-empty-text">Chọn một mục trên cây để xem chi tiết<br />hoặc nhấn nút thêm mới</div>
            </div>
        )

        /* EDIT MAJOR */
        if (panel === PANEL.EDIT_MAJOR && selectedMajor) {
            return (
                <>
                    <div className="cc-rp-header">
                        <div className="cc-rp-meta">
                            <div className="cc-rp-eyebrow">Ngành học</div>
                            <div className="cc-rp-title">{selectedMajor.name}</div>
                        </div>
                        <div className="cc-rp-btns">
                            <button 
                                className="cc-btn cc-btn-danger-sm" 
                                onClick={() => showToast("Không xoá cứng để tránh mất dữ liệu liên quan. Hãy bấm chấm tròn trạng thái ngoài cây danh mục để ẩn ngành này.", "info")}  
                                type="button"
                            ><Trash2 size={13} strokeWidth={2.4} /> Xóa</button>
                            <button 
                                className="cc-btn cc-btn-save" 
                                onClick={async () => {
                                    // Tên toàn khoảng trắng cũng phải bị chặn (DEF_91)
                                    if (!form.name?.trim() || !form.code?.trim()) {
                                        showToast("Vui lòng điền đầy đủ thông tin bắt buộc", "warning");
                                        return;
                                    }
                                    try {
                                        const updated = await updateMajor(selectedMajor.id, {
                                            code: form.code,
                                            name: form.name,
                                            description: form.description || ""
                                        });

                                        if (selectedFile) {
                                            await uploadMajorImage(form.code, selectedFile);
                                        }

                                        showToast("Đã lưu ngành học");
                                        const freshTree = await loadTreeData();
                                        const refreshedMajor = freshTree?.find(m => m.id === selectedMajor.id) || { ...updated, specializations: selectedMajor.specializations };
                                        selectMajor(refreshedMajor);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || err.message, "error");
                                    }
                                }} 
                                type="button"
                            ><Save size={13} strokeWidth={2.4} /> Lưu thay đổi</button>
                        </div>
                    </div>
                    <div className="cc-rp-body">
                        <div className="cc-status-row">
                            <span className="cc-status-label">Trạng thái</span>
                            <CmSelect
                                size="sm"
                                tinted
                                width="180px"
                                options={activeStatusOptions}
                                value={selectedMajor.isActive ? 'published' : 'hidden'}
                                onChange={async (val) => {
                                    const isActive = val === 'published';
                                    try {
                                        const updated = await updateMajorStatus(selectedMajor.id, isActive);
                                        await loadTreeData();
                                        selectMajor({ ...updated, specializations: selectedMajor.specializations });
                                    } catch (err) {
                                        showToast(err.response?.data?.message || "Không đổi được trạng thái", "error");
                                    }
                                }}
                            />
                        </div>
                        <FormRow label="Tên ngành" required maxLen={100}>
                            <input className="cc-input" type="text" value={form.name} maxLength={100} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mã ngành" required>
                            <input className="cc-input" type="text" value={form.code} maxLength={CODE_MAX} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mô tả" maxLen={500}>
                            <textarea className="cc-input cc-textarea" maxLength={500} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </FormRow>

                        <FormRow label="Ảnh đại diện ngành học">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedFile ? (
                                    <div className="cc-image-preview-container">
                                        <img src={URL.createObjectURL(selectedFile)} className="cc-major-image-preview" alt="Ảnh vừa chọn" />
                                        <span className="cc-image-preview-tag cc-image-preview-tag--new">Ảnh mới chọn</span>
                                    </div>
                                ) : selectedMajor.imageUrl ? (
                                    <div className="cc-image-preview-container">
                                        <img src={selectedMajor.imageUrl} className="cc-major-image-preview" alt="Ảnh hiện tại" />
                                        <span className="cc-image-preview-tag">Ảnh hiện tại</span>
                                    </div>
                                ) : null}
                                <input 
                                    className="cc-input" 
                                    type="file" 
                                    accept="image/png, image/jpeg" 
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }} 
                                />
                            </div>
                        </FormRow>
                    </div>
                </>
            )
        }

        /* EDIT SPEC */
        if (panel === PANEL.EDIT_SPEC && selectedSpecDetail) {
            const { spec, major } = selectedSpecDetail;
            return (
                <>
                    <div className="cc-rp-header">
                        <div className="cc-rp-meta">
                            <div className="cc-rp-eyebrow">Chuyên ngành · {major.name}</div>
                            <div className="cc-rp-title">{spec.name}</div>
                        </div>
                        <div className="cc-rp-btns">
                            <button 
                                className="cc-btn cc-btn-danger-sm" 
                                onClick={() => showToast("Không xoá cứng để tránh mất dữ liệu liên quan. Hãy bấm chấm tròn trạng thái ngoài cây danh mục để ẩn chuyên ngành này.", "info")}  
                                type="button"
                            ><Trash2 size={13} strokeWidth={2.4} /> Xóa</button>
                            <button 
                                className="cc-btn cc-btn-save" 
                                onClick={async () => {
                                    // Tên toàn khoảng trắng cũng phải bị chặn (DEF_91)
                                    if (!form.name?.trim() || !form.code?.trim() || !form.parentId) {
                                        showToast("Vui lòng điền đầy đủ thông tin bắt buộc", "warning");
                                        return;
                                    }
                                    try {
                                        const updated = await updateSpecialization(spec.id, {
                                            majorId: form.parentId,
                                            code: form.code,
                                            name: form.name,
                                            description: form.description || ""
                                        });
                                        if (selectedFile) {
                                            await uploadSpecializationImage(form.code, selectedFile);
                                        }
                                        showToast("Đã lưu chuyên ngành");
                                        const updatedTree = await loadTreeData();
                                        let newMajor = major;
                                        if (updatedTree) {
                                            newMajor = updatedTree.find(m => m.id === form.parentId) || major;
                                        }
                                        selectSpec({ ...updated, narrowSpecs: spec.narrowSpecs }, newMajor);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || err.message, "error");
                                    }
                                }} 
                                type="button"
                            ><Save size={13} strokeWidth={2.4} /> Lưu thay đổi</button>
                        </div>
                    </div>
                    <div className="cc-rp-body">
                        <div className="cc-status-row">
                            <span className="cc-status-label">Trạng thái</span>
                            <CmSelect
                                size="sm"
                                tinted
                                width="180px"
                                options={activeStatusOptions}
                                value={spec.isActive ? 'published' : 'hidden'}
                                onChange={async (val) => {
                                    const isActive = val === 'published';
                                    try {
                                        const updated = await updateSpecializationStatus(spec.id, isActive);
                                        await loadTreeData();
                                        selectSpec({ ...updated, narrowSpecs: spec.narrowSpecs }, major);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || "Không đổi được trạng thái", "error");
                                    }
                                }}
                            />
                        </div>
                        <div className="cc-info-grid" style={{ gridTemplateColumns: '1fr', marginBottom: 16 }}>
                            <div className="cc-info-box">
                                <div className="cc-info-lbl">Số lượng CN hẹp</div>
                                <div className="cc-info-val blue">{spec.narrowSpecs ? spec.narrowSpecs.length : 0} CN</div>
                            </div>
                        </div>
                        <FormRow label="Tên chuyên ngành" required maxLen={100}>
                            <input className="cc-input" type="text" value={form.name} maxLength={100} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mã chuyên ngành" required>
                            <input className="cc-input" type="text" value={form.code} maxLength={CODE_MAX} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Ngành cha" required>
                            <select className="cc-input cc-select" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                                {tree.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </FormRow>
                        <FormRow label="Mô tả" maxLen={500}>
                            <textarea className="cc-input cc-textarea" maxLength={500} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Ảnh đại diện chuyên ngành">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedFile ? (
                                    <div className="cc-image-preview-container">
                                        <img src={URL.createObjectURL(selectedFile)} className="cc-major-image-preview" alt="Ảnh vừa chọn" />
                                        <span className="cc-image-preview-tag cc-image-preview-tag--new">Ảnh mới chọn</span>
                                    </div>
                                ) : spec.imageUrl ? (
                                    <div className="cc-image-preview-container">
                                        <img src={spec.imageUrl} className="cc-major-image-preview" alt="Ảnh hiện tại" />
                                        <span className="cc-image-preview-tag">Ảnh hiện tại</span>
                                    </div>
                                ) : null}
                                <input 
                                    className="cc-input" 
                                    type="file" 
                                    accept="image/png, image/jpeg" 
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }} 
                                />
                            </div>
                        </FormRow>
                    </div>
                </>
            )
        }

        /* EDIT NS */
        if (panel === PANEL.EDIT_NS && selectedNS) {
            const { ns, spec, major } = selectedNS
            return (
                <>
                    <div className="cc-rp-header">
                        <div className="cc-rp-meta">
                            <div className="cc-rp-eyebrow">Chuyên ngành hẹp · {spec.name}</div>
                            <div className="cc-rp-title">{ns.name}</div>
                        </div>
                        <div className="cc-rp-btns">
                            <button 
                                className="cc-btn cc-btn-danger-sm" 
                                onClick={() => showToast("Không xoá cứng để tránh mất dữ liệu liên quan. Hãy chuyển trạng thái về Bản nháp để ẩn chuyên ngành hẹp này khỏi sinh viên.", "info")}  
                                type="button"
                            ><Trash2 size={13} strokeWidth={2.4} /> Xóa</button>
                            <button 
                                className="cc-btn cc-btn-save" 
                                onClick={async () => {
                                    // Tên toàn khoảng trắng cũng phải bị chặn (DEF_91)
                                    if (!form.name?.trim() || !form.code?.trim() || !form.parentId) {
                                        showToast("Vui lòng điền đầy đủ thông tin bắt buộc", "warning");
                                        return;
                                    }
                                    try {
                                        const updated = await updateNarrowSpec(ns.id, {
                                            specializationId: form.parentId,
                                            code: form.code,
                                            name: form.name,
                                            description: form.description || ""
                                        });
                                        showToast("Đã lưu chuyên ngành hẹp");
                                        const updatedTree = await loadTreeData();
                                        let newSpec = spec;
                                        let newMajor = major;
                                        if (updatedTree) {
                                            for (const m of updatedTree) {
                                                const foundSpec = m.specializations.find(s => s.id === form.parentId);
                                                if (foundSpec) {
                                                    newSpec = foundSpec;
                                                    newMajor = m;
                                                    break;
                                                }
                                            }
                                        }
                                        await selectNS(updated, newSpec, newMajor);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || err.message, "error");
                                    }
                                }} 
                                type="button"
                            ><Save size={13} strokeWidth={2.4} /> Lưu thay đổi</button>
                        </div>
                    </div>

                    <div className="cc-rp-body">
                        {/* Status dropdown */}
                        <div className="cc-status-row">
                            <span className="cc-status-label">Trạng thái</span>
                            <CmSelect
                                size="sm"
                                tinted
                                width="180px"
                                options={statusOptions}
                                value={nsStatus}
                                onChange={async (val) => {
                                    const shouldPublish = val === 'published';
                                    try {
                                        await publishNarrowSpec(ns.id, shouldPublish);
                                        setNsStatus(val);
                                        showToast(
                                            shouldPublish
                                                ? "Đã công bố chuyên ngành hẹp"
                                                : val === 'hidden'
                                                    ? "Đã chuyển chuyên ngành hẹp sang đang ẩn"
                                                    : "Đã chuyển chuyên ngành hẹp về bản nháp"
                                        );
                                        await loadTreeData();
                                    } catch (err) {
                                        showToast(err.response?.data?.message || "Không đổi được trạng thái", "error");
                                    }
                                }}
                            />
                            {nsStatus === 'published' && ns.publishedAt && (
                                <span className="cc-status-since">kể từ {ns.publishedAt}</span>
                            )}
                        </div>

                        {/* Bảng kiểm điều kiện publish: hàm getChecklist() đã có sẵn nhưng
                            không được gọi ở đâu, nên CM bấm công bố mà không biết còn thiếu gì (DEF_82) */}
                        <div className="cc-checklist">
                            <div className="cc-checklist-title">Điều kiện công bố</div>
                            {getChecklist(ns, spec?.isActive !== false).map((c) => (
                                <div key={c.label} className={`cc-checklist-row cc-checklist-row--${c.ok ? 'ok' : 'missing'}`}>
                                    <span className="cc-checklist-mark">{c.ok ? '✓' : '✗'}</span>
                                    <span className="cc-checklist-label">{c.label}</span>
                                    <span className="cc-checklist-val">{c.val}</span>
                                </div>
                            ))}
                        </div>

                        {/* Form fields directly editable */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', marginBottom: '24px' }}>
                            <FormRow label="Tên chuyên ngành hẹp" required maxLen={100}>
                                <input className="cc-input" type="text" value={form.name} maxLength={100} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                            </FormRow>
                            <FormRow label="Mã" required>
                                <input className="cc-input" type="text" value={form.code} maxLength={CODE_MAX} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                            </FormRow>
                            <FormRow label="Chuyên ngành cha" required>
                                <select className="cc-input cc-select" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                                    {tree.flatMap(m => m.specializations).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </FormRow>
                            <FormRow label="Mô tả" maxLen={500}>
                                <textarea className="cc-input cc-textarea" maxLength={500} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                            </FormRow>
                        </div>
                    </div>
                </>
            )
        }

        /* ADD NS */
        if (panel === PANEL.ADD_NS) {
            return (
                <>
                    <div className="cc-rp-header">
                        <div className="cc-rp-meta">
                            <div className="cc-rp-eyebrow">Thêm mới · Chuyên ngành hẹp</div>
                            <div className="cc-rp-title">Chuyên ngành hẹp mới</div>
                        </div>
                        <div className="cc-rp-btns">
                            <button 
                                className="cc-btn cc-btn-save" 
                                onClick={async () => {
                                    // Tên toàn khoảng trắng cũng phải bị chặn (DEF_91)
                                    if (!form.name?.trim() || !form.code?.trim() || !form.parentId) {
                                        showToast("Vui lòng điền đầy đủ thông tin bắt buộc", "warning");
                                        return;
                                    }
                                    try {
                                        await createNarrowSpec({
                                            specializationId: form.parentId,
                                            code: form.code,
                                            name: form.name,
                                            description: form.description || ""
                                        });
                                        showToast("Đã tạo chuyên ngành hẹp");
                                        await loadTreeData();
                                        setPanel(PANEL.EMPTY);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || err.message, "error");
                                    }
                                }} 
                                type="button"
                            ><Plus size={13} strokeWidth={2.6} /> Tạo chuyên ngành hẹp</button>
                        </div>
                    </div>
                    <div className="cc-rp-body">
                        <FormRow label="Tên chuyên ngành hẹp" required maxLen={100}>
                            <input className="cc-input" type="text" placeholder="Vd: Cybersecurity Engineering" maxLength={100} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mã" required hint="Mã duy nhất trong toàn hệ thống">
                            <input className="cc-input" type="text" placeholder="Vd: SE-SEC" maxLength={CODE_MAX} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Chuyên ngành cha" required>
                            <select className="cc-input cc-select" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                                <option value="" disabled>Chọn chuyên ngành...</option>
                                {tree.flatMap(m => m.specializations || []).map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({tree.find(m => m.specializations?.includes(s))?.name})</option>
                                ))}
                            </select>
                        </FormRow>
                        <FormRow label="Mô tả" maxLen={500}>
                            <textarea className="cc-input cc-textarea" placeholder="Mô tả ngắn (tùy chọn, tối đa 500 ký tự)..." maxLength={500} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </FormRow>
                        <p className="cc-form-note">Sau khi tạo, chuyên ngành hẹp ở trạng thái <strong>Bản nháp</strong>. Cần cấu hình đầy đủ trước khi công bố cho sinh viên.</p>
                    </div>
                </>
            )
        }

        /* ADD SPEC */
        if (panel === PANEL.ADD_SPEC) {
            return (
                <>
                    <div className="cc-rp-header">
                        <div className="cc-rp-meta">
                            <div className="cc-rp-eyebrow">Thêm mới · Chuyên ngành</div>
                            <div className="cc-rp-title">Chuyên ngành mới</div>
                        </div>
                        <div className="cc-rp-btns">
                            <button 
                                className="cc-btn cc-btn-save" 
                                onClick={async () => {
                                    // Tên toàn khoảng trắng cũng phải bị chặn (DEF_91)
                                    if (!form.name?.trim() || !form.code?.trim() || !form.parentId) {
                                        showToast("Vui lòng điền đầy đủ thông tin bắt buộc", "warning");
                                        return;
                                    }
                                    try {
                                        await createSpecialization({
                                            majorId: form.parentId,
                                            code: form.code,
                                            name: form.name,
                                            description: form.description || ""
                                        });
                                        if (selectedFile) {
                                            await uploadSpecializationImage(form.code, selectedFile);
                                        }
                                        showToast("Đã tạo chuyên ngành");
                                        await loadTreeData();
                                        setPanel(PANEL.EMPTY);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || err.message, "error");
                                    }
                                }} 
                                type="button"
                            ><Plus size={13} strokeWidth={2.6} /> Tạo chuyên ngành</button>
                        </div>
                    </div>
                    <div className="cc-rp-body">
                        <FormRow label="Tên chuyên ngành" required maxLen={100}>
                            <input className="cc-input" type="text" placeholder="Vd: Artificial Intelligence" maxLength={100} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mã" required>
                            <input className="cc-input" type="text" placeholder="Vd: AI" maxLength={CODE_MAX} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Ngành cha" required>
                            <select className="cc-input cc-select" value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}>
                                <option value="" disabled>Chọn ngành học...</option>
                                {tree.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </FormRow>
                        <FormRow label="Mô tả" maxLen={500}>
                            <textarea className="cc-input cc-textarea" placeholder="Mô tả ngắn (tùy chọn)..." maxLength={500} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Ảnh đại diện chuyên ngành">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedFile && (
                                    <div className="cc-image-preview-container">
                                        <img src={URL.createObjectURL(selectedFile)} className="cc-major-image-preview" alt="Ảnh vừa chọn" />
                                        <span className="cc-image-preview-tag cc-image-preview-tag--new">Ảnh mới chọn</span>
                                    </div>
                                )}
                                <input 
                                    className="cc-input" 
                                    type="file" 
                                    accept="image/png, image/jpeg" 
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }} 
                                />
                            </div>
                        </FormRow>
                    </div>
                </>
            )
        }

        /* ADD MAJOR */
        if (panel === PANEL.ADD_MAJOR) {
            return (
                <>
                    <div className="cc-rp-header">
                        <div className="cc-rp-meta">
                            <div className="cc-rp-eyebrow">Thêm mới · Ngành học</div>
                            <div className="cc-rp-title">Ngành mới</div>
                        </div>
                        <div className="cc-rp-btns">
                            <button 
                                className="cc-btn cc-btn-save" 
                                onClick={async () => {
                                    // Tên toàn khoảng trắng cũng phải bị chặn (DEF_91)
                                    if (!form.name?.trim() || !form.code?.trim()) {
                                        showToast("Vui lòng nhập đầy đủ tên ngành và mã ngành", "warning");
                                        return;
                                    }
                                    try {
                                        await createMajor({
                                            code: form.code,
                                            name: form.name,
                                            description: form.description || ""
                                        });

                                        if (selectedFile) {
                                            await uploadMajorImage(form.code, selectedFile);
                                        }

                                        showToast("Đã tạo ngành học");
                                        await loadTreeData();
                                        setPanel(PANEL.EMPTY);
                                    } catch (err) {
                                        showToast(err.response?.data?.message || err.message, "error");
                                    }
                                }} 
                                type="button"
                            ><Plus size={13} strokeWidth={2.6} /> Tạo ngành học</button>
                        </div>
                    </div>
                    <div className="cc-rp-body">
                        <FormRow label="Tên ngành" required maxLen={100}>
                            <input className="cc-input" type="text" placeholder="Vd: Luật" maxLength={100} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mã ngành" required>
                            <input className="cc-input" type="text" placeholder="Vd: LAW" maxLength={CODE_MAX} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Mô tả" maxLen={500}>
                            <textarea className="cc-input cc-textarea" placeholder="Mô tả ngắn (tùy chọn)..." maxLength={500} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </FormRow>
                        <FormRow label="Ảnh đại diện ngành học">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedFile && (
                                    <div className="cc-image-preview-container">
                                        <img src={URL.createObjectURL(selectedFile)} className="cc-major-image-preview" alt="Ảnh vừa chọn" />
                                        <span className="cc-image-preview-tag cc-image-preview-tag--new">Ảnh mới chọn</span>
                                    </div>
                                )}
                                <input 
                                    className="cc-input" 
                                    type="file" 
                                    accept="image/png, image/jpeg" 
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }} 
                                />
                            </div>
                        </FormRow>
                        <p className="cc-form-note">Ngành mới sẽ ở trạng thái <strong>đang hoạt động</strong> và xuất hiện trong cây danh mục ngay sau khi tạo.</p>
                    </div>
                </>
            )
        }

        return null
    }

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="cc-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><Folder size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Cây danh mục ngành</h1>
                            <p className="cm-page-sub">
                                Quản lý cấu trúc ngành học, chuyên ngành và chuyên ngành hẹp của toàn hệ thống
                            </p>
                        </div>
                    </div>
                </header>
                <div className="cc-wrap">

                    {/* ══ LEFT TREE ══ */}
                    <div className="cc-tree-panel">
                        <div className="cc-tree-top">
                            {/* Ô tìm kiếm */}
                            <div className="cc-search-box">
                                <Search size={14} strokeWidth={2.4} className="cc-search-icon" />
                                <input
                                    className="cc-tree-search"
                                    placeholder="Tìm theo tên ngành..."
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Filter dropdowns — panel mở ra rộng đúng bằng ô lọc */}
                            <div className="cc-filter-row">
                                <CmSelect
                                    size="sm"
                                    highlightActive
                                    placeholder="Tất cả ngành"
                                    value={filterMajor}
                                    onChange={setFilterMajor}
                                    options={[
                                        { value: '', label: 'Tất cả ngành' },
                                        ...tree.map(m => ({ value: String(m.id), label: m.name }))
                                    ]}
                                />
                                <CmSelect
                                    size="sm"
                                    highlightActive
                                    placeholder="Tất cả trạng thái"
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    options={[
                                        { value: '', label: 'Tất cả trạng thái' },
                                        { value: 'published', label: 'Đã công bố' },
                                        { value: 'draft', label: 'Bản nháp' },
                                        { value: 'hidden', label: 'Đang ẩn' }
                                    ]}
                                />
                            </div>

                            {/* Active filter tags */}
                            {activeTags.length > 0 && (
                                <div className="cc-filter-tags">
                                    {activeTags.map((t, i) => (
                                        <span key={i} className="cm-tag cm-tag--blue">
                                            <span>{t.label}</span>
                                            <button className="cm-tag-dismiss" onClick={t.clear} type="button" aria-label={`Bỏ lọc ${t.label}`}>
                                                <X size={12} strokeWidth={3} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Chỉ có nút + Major trên header */}
                            <div className="cc-add-major-wrap">
                                <button className="cc-btn-add-major" onClick={openAddMajor} type="button">
                                    <Plus size={13} strokeWidth={2.6} /> Thêm ngành học
                                </button>
                            </div>
                        </div>

                        {/* Tree */}
                        <div className="cc-tree-scroll">
                            {loading ? (
                                <div className="cc-tree-empty">Đang tải cây danh mục…</div>
                            ) : treeError ? (
                                <div className="cc-tree-empty" style={{ color: '#B91C1C' }}>
                                    {treeError} Đây là lỗi tải dữ liệu, không phải danh mục trống.{' '}
                                    <button type="button" className="cc-btn-link" onClick={loadTreeData}>Thử lại</button>
                                </div>
                            ) : filteredTree.length === 0 ? (
                                <div className="cc-tree-empty">Không có kết quả</div>
                            ) : null}
                            {filteredTree.map(major => (
                                <div key={major.id} className="cc-major-node">
                                    <div className={`cc-major-head${selectedMajor?.id === major.id ? ' sel' : ''}`}>
                                        <span className={`cc-chevron${expandedMajors[major.id] ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); toggleMajor(major.id) }}><ChevronRight size={14} strokeWidth={2.6} /></span>
                                        {/* FDS yêu cầu hiện mã cạnh tên ở cả 3 cấp (DEF_86) */}
                                        <span className="cc-node-label" onClick={() => selectMajor(major)}>
                                            {major.code ? `${major.code} — ${major.name}` : major.name}
                                        </span>
                                        <button
                                            className="cc-btn-inline cc-btn-inline--spec"
                                            onClick={e => { e.stopPropagation(); setSelectedFile(null); setForm({ name: '', code: '', parentId: major.id, description: '' }); setPanel(PANEL.ADD_SPEC) }}
                                            type="button"
                                            title={`Thêm chuyên ngành vào ${major.name}`}
                                        >+ Chuyên ngành</button>
                                        <span 
                                            className={`cc-node-dot ${major.isActive ? 'dot-active' : 'dot-hidden'}`} 
                                            title={major.isActive ? 'Click để Ẩn' : 'Click để Kích hoạt'} 
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    await updateMajorStatus(major.id, !major.isActive);
                                                    await loadTreeData();
                                                } catch (err) {
                                                    showToast(err.response?.data?.message || err.message, "error");
                                                }
                                            }}
                                        />
                                    </div>

                                    {expandedMajors[major.id] && (!major.specializations || major.specializations.length === 0) && (
                                        <div className="cc-spec-list">
                                            <div className="cc-tree-empty">Chưa có chuyên ngành nào</div>
                                        </div>
                                    )}

                                    {expandedMajors[major.id] && major.specializations && major.specializations.length > 0 && (
                                        <div className="cc-spec-list">
                                            {major.specializations.map(spec => (
                                                <div key={spec.id} className="cc-spec-node">
                                                    <div className={`cc-spec-head${selectedSpecDetail?.spec?.id === spec.id ? ' sel' : ''}`}>
                                                        <span className={`cc-chevron cc-chevron--sm${expandedSpecs[spec.id] ? ' open' : ''}`} onClick={(e) => { e.stopPropagation(); toggleSpec(spec.id) }}><ChevronRight size={12} strokeWidth={2.6} /></span>
                                                        <span className="cc-spec-label" onClick={() => selectSpec(spec, major)}>
                                                            {spec.code ? `${spec.code} — ${spec.name}` : spec.name}
                                                        </span>
                                                        <button
                                                            className="cc-btn-inline cc-btn-inline--ns"
                                                            onClick={e => { e.stopPropagation(); setSelectedFile(null); setForm({ name: '', code: '', parentId: spec.id, description: '' }); setPanel(PANEL.ADD_NS) }}
                                                            type="button"
                                                            title={`Thêm CN hẹp vào ${spec.name}`}
                                                        >+ CN hẹp</button>
                                                        {/* Đếm theo danh sách ĐÃ LỌC để khớp số dòng thật đang hiện (DEF_85) */}
                                                        <span className="cc-spec-count">{visibleNarrowSpecs(spec, major).length} CN hẹp</span>
                                                        <span 
                                                            className={`cc-node-dot ${spec.isActive ? 'dot-active' : 'dot-hidden'}`} 
                                                            style={{ marginLeft: 8 }}
                                                            title={spec.isActive ? 'Click để Ẩn' : 'Click để Kích hoạt'} 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    await updateSpecializationStatus(spec.id, !spec.isActive);
                                                                    await loadTreeData();
                                                                } catch (err) {
                                                                    showToast(err.response?.data?.message || err.message, "error");
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    {expandedSpecs[spec.id] && (!spec.narrowSpecs || spec.narrowSpecs.length === 0) && (
                                                        <div className="cc-ns-list">
                                                            <div className="cc-tree-empty">Chưa có chuyên ngành hẹp nào</div>
                                                        </div>
                                                    )}

                                                    {expandedSpecs[spec.id] && spec.narrowSpecs && spec.narrowSpecs.length > 0 && (
                                                        <div className="cc-ns-list">
                                                            {visibleNarrowSpecs(spec, major)
                                                                .map(ns => {
                                                                    const isSel = selectedNS?.ns?.id === ns.id && panel === PANEL.EDIT_NS
                                                                    return (
                                                                        <div
                                                                            key={ns.id}
                                                                            className={`cc-ns-row${isSel ? ' sel' : ''}`}
                                                                            onClick={() => selectNS(ns, spec, major)}
                                                                        >
                                                                            <span className={`cc-ns-dot ${ns.isPublished ? 'dot-pub' : 'dot-draft'}`} />
                                                                            <span className="cc-ns-label">
                                                                                {ns.code ? `${ns.code} — ${ns.name}` : ns.name}
                                                                            </span>
                                                                            <span className={`cm-tag cm-tag--${ns.isPublished ? 'green' : 'orange'} cc-ns-status`}>
                                                                                {ns.isPublished ? 'Đã công bố' : 'Bản nháp'}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {major.specializations.length === 0 && (
                                                <div className="cc-tree-empty-sub">Chưa có chuyên ngành nào</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ══ RIGHT PANEL ══ */}
                    <div className="cc-right-panel">
                        {renderPanel()}
                    </div>

                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}

/* ── FormRow helper ── */
function FormRow({ label, required, hint, maxLen, children }) {
    // Khởi tạo 0 rồi không đồng bộ lại nên mở panel sửa (trường đã có nội dung)
    // bộ đếm vẫn hiện 0 cho tới khi người dùng gõ (DEF_81)
    const initialLen = String(children?.props?.value ?? '').length
    const [count, setCount] = useState(initialLen)
    useEffect(() => { setCount(initialLen) }, [initialLen])
    const childWithHandler = maxLen
        ? (() => {
            const child = children
            const origChange = child.props.onChange
            return {
                ...child,
                props: {
                    ...child.props,
                    onChange: (e) => { setCount(e.target.value.length); origChange?.(e) },
                },
            }
        })()
        : children

    return (
        <div className="cc-form-row">
            <div className="cc-form-label">
                {label}{required && <span className="cc-req">*</span>}
            </div>
            {childWithHandler}
            {maxLen && <div className="cc-char-count">{count} / {maxLen}</div>}
            {hint && <div className="cc-form-hint">{hint}</div>}
        </div>
    )
}