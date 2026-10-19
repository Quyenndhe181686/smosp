import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../services/authService'
import { AlertTriangle } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import { submitErrorReport } from '../../services/reportService'
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization } from '../../services/catalogService'
import { searchCourseOptions, getCourseDetail } from '../../services/courseService'
import { getMyRoadmaps } from '../../services/roadmapService'
import './SubmitErrorReportPage.css'

// Phải khớp đủ 6 giá trị enum ReportEntityType phía backend
const ENTITY_TYPES = [
    { value: 'MAJOR', label: 'Ngành học' },
    { value: 'SPECIALIZATION', label: 'Chuyên ngành' },
    { value: 'NARROW_SPEC', label: 'Chuyên ngành hẹp' },
    { value: 'COURSE', label: 'Môn học' },
    { value: 'RESOURCE', label: 'Tài nguyên học tập' },
    { value: 'ROADMAP', label: 'Lộ trình học tập' },
]

const DESC_MAX = 1000

export default function SubmitErrorReportPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const username = localStorage.getItem('username') || 'Sinh viên'

    const stateData = location.state || null

    // Base state
    const [entityType, setEntityType] = useState(stateData?.entityType || 'MAJOR')
    const [entityId, setEntityId] = useState(stateData?.entityId || '')
    const [pageLabel, setPageLabel] = useState(stateData?.pageLabel || '')
    const [description, setDescription] = useState('')
    const [error, setError] = useState(null)
    const [submitted, setSubmitted] = useState(null) // { id, at } | null

    // Catalog state lists
    const [majors, setMajors] = useState([])
    const [specializations, setSpecializations] = useState([])
    const [narrowSpecs, setNarrowSpecs] = useState([])
    const [courses, setCourses] = useState([])
    const [resources, setResources] = useState([])
    const [roadmaps, setRoadmaps] = useState([])

    // Lỗi tải danh mục — trước đây chỉ console.error nên form chết im lặng (DEF_166)
    const [majorsError, setMajorsError] = useState(null)
    const [coursesError, setCoursesError] = useState(null)
    const [roadmapsError, setRoadmapsError] = useState(null)
    const [resourcesError, setResourcesError] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)

    // Course search filter query
    const [courseFilter, setCourseFilter] = useState('')
    const [courseSearching, setCourseSearching] = useState(false)

    // Catalog selections (for direct sidebar access)
    const [selectedMajorId, setSelectedMajorId] = useState('')
    const [selectedSpecId, setSelectedSpecId] = useState('')
    const [selectedNsId, setSelectedNsId] = useState('')
    const [selectedCourseId, setSelectedCourseId] = useState('')
    const [selectedResourceId, setSelectedResourceId] = useState('')
    const [selectedRoadmapId, setSelectedRoadmapId] = useState('')

    /* Kết quả đã do máy chủ lọc sẵn theo từ khoá, không lọc lại phía client. */
    const filteredCourses = courses

    // Fetch initial list of Majors
    useEffect(() => {
        if (!stateData) {
            getMajors()
                .then(data => { setMajors(data.filter(m => m.isActive)); setMajorsError(null) })
                .catch(err => {
                    console.error('Failed to load majors:', err)
                    setMajorsError(err.response?.data?.message || 'Không tải được danh sách Ngành học.')
                })

            /* KHÔNG tải sẵn toàn bộ môn học ở đây nữa: getCourses() gọi vào
               GET /api/courses của CmCourseController (@PreAuthorize
               hasAnyRole('CONTENT_MANAGER')) nên sinh viên luôn nhận 403 và ô
               chọn môn vĩnh viễn rỗng. Đã thay bằng tìm kiếm phía máy chủ qua
               /api/courses/search — xem effect tìm môn bên dưới. */

            getMyRoadmaps()
                .then(data => { setRoadmaps(data || []); setRoadmapsError(null) })
                .catch(err => {
                    console.error('Failed to load roadmaps:', err)
                    setRoadmapsError(err.response?.data?.message || 'Không tải được danh sách Lộ trình học tập của bạn.')
                })
        }
    }, [stateData, reloadKey])

    // Tài nguyên học tập nằm trong chi tiết môn học -> chọn môn trước, rồi chọn tài nguyên
    useEffect(() => {
        if (entityType !== 'RESOURCE' || !selectedCourseId) {
            setResources([])
            setSelectedResourceId('')
            setResourcesError(null)
            return
        }
        getCourseDetail(selectedCourseId)
            .then(data => {
                setResources(data.learningResources || [])
                setSelectedResourceId('')
                setResourcesError(null)
            })
            .catch(err => {
                console.error('Failed to load course resources:', err)
                setResources([])
                setResourcesError(err.response?.data?.message || 'Không tải được danh sách tài nguyên của môn học này.')
            })
    }, [entityType, selectedCourseId])

    /* Tìm môn học phía máy chủ theo từ khoá.

       Bản cũ tải TOÀN BỘ môn học một lần qua getCourses() — vốn là API quản trị
       của Content Manager nên sinh viên luôn nhận 403, lỗi bị nuốt vào console và
       danh sách môn vĩnh viễn rỗng: gõ gì cũng ra "Không tìm thấy môn học nào".
       Nay gọi endpoint tìm kiếm dành cho người dùng cuối, và lỗi được hiện ra màn
       hình thay vì giả vờ là "không có kết quả". */
    useEffect(() => {
        // Cả RESOURCE cũng dùng ô tìm môn này (chọn môn trước rồi mới chọn tài
        // nguyên của môn đó) — chặn ở mỗi 'COURSE' sẽ làm luồng RESOURCE không
        // bao giờ có môn để chọn.
        if (stateData || (entityType !== 'COURSE' && entityType !== 'RESOURCE')) return

        const keyword = courseFilter.trim()
        let alive = true

        // Mọi setState nằm trong callback của timer, không gọi thẳng trong thân
        // effect — vừa tránh cascading render, vừa gộp luôn việc chờ người dùng
        // ngừng gõ để không bắn request mỗi ký tự.
        const timer = setTimeout(() => {
            if (!alive) return
            if (!keyword) {
                setCourses([])
                setCoursesError(null)
                setCourseSearching(false)
                return
            }
            setCourseSearching(true)
            searchCourseOptions(keyword)
                .then(data => {
                    if (!alive) return
                    setCourses(Array.isArray(data) ? data : [])
                    setCoursesError(null)
                })
                .catch(err => {
                    if (!alive) return
                    console.error('Failed to search courses:', err)
                    setCourses([])
                    setCoursesError(
                        err.response?.data?.message || 'Không tải được danh sách môn học. Vui lòng thử lại.'
                    )
                })
                .finally(() => { if (alive) setCourseSearching(false) })
        }, 300)

        return () => { alive = false; clearTimeout(timer) }
    }, [courseFilter, entityType, stateData])

    // Load specializations when major changes
    useEffect(() => {
        if (!selectedMajorId) {
            setSpecializations([])
            setSelectedSpecId('')
            return
        }
        getSpecializationsByMajor(selectedMajorId)
            .then(data => {
                const activeSpecs = data.filter(s => s.isActive)
                setSpecializations(activeSpecs)
                setSelectedSpecId('')
                setMajorsError(null)
            })
            .catch(err => {
                console.error('Failed to load specs:', err)
                setMajorsError(err.response?.data?.message || 'Không tải được danh sách Chuyên ngành của Ngành đã chọn.')
            })
    }, [selectedMajorId])

    // Load narrow specs when specialization changes
    useEffect(() => {
        if (!selectedSpecId) {
            setNarrowSpecs([])
            setSelectedNsId('')
            return
        }
        getNarrowSpecsBySpecialization(selectedSpecId)
            .then(data => {
                const activeNs = data.filter(n => n.isPublished)
                setNarrowSpecs(activeNs)
                setSelectedNsId('')
                setMajorsError(null)
            })
            .catch(err => {
                console.error('Failed to load narrow specs:', err)
                setMajorsError(err.response?.data?.message || 'Không tải được danh sách Chuyên ngành hẹp.')
            })
    }, [selectedSpecId])

    // Update entityId and pageLabel based on manual selections
    useEffect(() => {
        if (stateData) return // Do not override prefilled state data

        if (entityType === 'MAJOR') {
            const major = majors.find(m => m.id === selectedMajorId)
            if (major) {
                setEntityId(major.id)
                setPageLabel(`Ngành: ${major.name} (${major.code})`)
            } else {
                setEntityId('')
                setPageLabel('')
            }
        } else if (entityType === 'SPECIALIZATION') {
            const spec = specializations.find(s => s.id === selectedSpecId)
            if (spec) {
                setEntityId(spec.id)
                setPageLabel(`Chuyên ngành: ${spec.name} (${spec.code})`)
            } else {
                setEntityId('')
                setPageLabel('')
            }
        } else if (entityType === 'NARROW_SPEC') {
            const ns = narrowSpecs.find(n => n.id === selectedNsId)
            if (ns) {
                setEntityId(ns.id)
                setPageLabel(`Chuyên ngành hẹp: ${ns.name} (${ns.code})`)
            } else {
                setEntityId('')
                setPageLabel('')
            }
        } else if (entityType === 'COURSE') {
            const course = courses.find(c => c.id === selectedCourseId)
            if (course) {
                setEntityId(course.id)
                setPageLabel(`Môn học: ${course.name} (${course.code})`)
            } else {
                setEntityId('')
                setPageLabel('')
            }
        } else if (entityType === 'RESOURCE') {
            const resource = resources.find(r => r.id === selectedResourceId)
            const course = courses.find(c => c.id === selectedCourseId)
            if (resource) {
                setEntityId(resource.id)
                setPageLabel(`Tài nguyên: ${resource.title}${course ? ` (môn ${course.code})` : ''}`)
            } else {
                setEntityId('')
                setPageLabel('')
            }
        } else if (entityType === 'ROADMAP') {
            const roadmap = roadmaps.find(r => r.id === selectedRoadmapId)
            if (roadmap) {
                setEntityId(roadmap.id)
                setPageLabel(`Lộ trình: ${roadmap.name || roadmap.narrowSpecName || roadmap.id}`)
            } else {
                setEntityId('')
                setPageLabel('')
            }
        }
    }, [entityType, selectedMajorId, selectedSpecId, selectedNsId, selectedCourseId, selectedResourceId, selectedRoadmapId, majors, specializations, narrowSpecs, courses, resources, roadmaps, stateData])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!entityId) {
            return setError('Vui lòng chọn nội dung cụ thể cần báo cáo lỗi')
        }
        if (!description.trim()) {
            return setError('Vui lòng nhập mô tả lỗi trước khi gửi')
        }
        if (description.length > DESC_MAX) {
            return setError(`Mô tả không được vượt quá ${DESC_MAX} ký tự`)
        }
        setError(null)

        try {
            const res = await submitErrorReport({
                entityType,
                entityId,
                description: description.trim(),
            })
            setSubmitted({
                id: res.id,
                at: new Date(res.createdAt || Date.now()).toLocaleString('vi-VN'),
            })
            setDescription('')
        } catch (err) {
            console.error('Failed to submit error report:', err)
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi báo cáo lên hệ thống')
        }
    }

    const handleSubmitAnother = () => {
        setSubmitted(null)
        if (!stateData) {
            setSelectedMajorId('')
            setSelectedSpecId('')
            setSelectedNsId('')
            setSelectedCourseId('')
            setSelectedResourceId('')
            setSelectedRoadmapId('')
            setEntityId('')
            setPageLabel('')
        }
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    return (
        <Layout
            role="student"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="ser-page">
                <div className="ser-header">
                    <h1 className="ser-title">
                        <span className="ser-title-icon"><AlertTriangle size={20} strokeWidth={2.5} /></span>
                        Báo lỗi nội dung
                    </h1>
                    <p className="ser-subtitle">Gửi báo cáo lỗi hiển thị hoặc sai thông tin đến Content Manager</p>
                </div>

                {submitted ? (
                    <div className="ser-success-card">
                        <div className="ser-success-icon">✓</div>
                        <div className="ser-success-title">Đã gửi báo cáo thành công</div>
                        <p className="ser-success-text">
                            Báo cáo của bạn đối với <strong>{pageLabel}</strong> đã được lưu trữ thành công.
                            Bạn có thể theo dõi tiến độ xử lý trong mục <strong>Báo cáo của tôi</strong>.
                        </p>
                        <div className="ser-success-actions">
                            <button className="ser-btn-ghost" type="button" onClick={handleSubmitAnother}>
                                Gửi báo cáo khác
                            </button>
                            <button className="ser-btn-primary" type="button" onClick={() => navigate('/student/my-reports')}>
                                Xem báo cáo của tôi
                            </button>
                        </div>
                    </div>
                ) : (
                    <form className="ser-card" onSubmit={handleSubmit}>
                        {stateData ? (
                            // Prefilled read-only state representation
                            <div className="ser-field-group">
                                <label className="ser-field-label" style={{ color: '#034EA2' }}>Nội dung báo lỗi (Tự động nhận diện)</label>
                                <div style={{
                                    background: '#f8fafc',
                                    border: '1px dashed #b5d4f4',
                                    borderRadius: '10px',
                                    padding: '14px 16px',
                                    fontSize: '13px',
                                    color: '#0d1b3e',
                                    lineHeight: '1.6'
                                }}>
                                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>{pageLabel}</div>
                                    <div style={{ color: '#9ca3af', fontSize: '11px' }}>Phân loại: {ENTITY_TYPES.find(t => t.value === entityType)?.label || entityType}</div>
                                </div>
                            </div>
                        ) : (
                            // Dropdown selections for direct page access
                            <>
                                {(majorsError || coursesError || roadmapsError) && (
                                    <div className="ser-form-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                        <span>{majorsError || coursesError || roadmapsError}</span>
                                        <button
                                            type="button"
                                            className="ser-btn-ghost"
                                            style={{ flexShrink: 0 }}
                                            onClick={() => { setMajorsError(null); setCoursesError(null); setRoadmapsError(null); setReloadKey(k => k + 1) }}
                                        >
                                            Thử lại
                                        </button>
                                    </div>
                                )}

                                <div className="ser-field-group">
                                    <label className="ser-field-label">Phân loại nội dung lỗi</label>
                                    <select
                                        className="ser-field-input"
                                        value={entityType}
                                        onChange={(e) => {
                                            setEntityType(e.target.value)
                                            setSelectedMajorId('')
                                            setSelectedSpecId('')
                                            setSelectedNsId('')
                                            setSelectedCourseId('')
                                            setSelectedResourceId('')
                                            setSelectedRoadmapId('')
                                            setCourseFilter('')
                                            setEntityId('')
                                            setPageLabel('')
                                        }}
                                    >
                                        {ENTITY_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {entityType !== 'COURSE' && entityType !== 'RESOURCE' && entityType !== 'ROADMAP' && (
                                    <div className="ser-field-group">
                                        <label className="ser-field-label">Chọn Ngành học</label>
                                        <select
                                            className="ser-field-input"
                                            value={selectedMajorId}
                                            onChange={(e) => setSelectedMajorId(e.target.value)}
                                        >
                                            <option value="">-- Chọn Ngành học --</option>
                                            {majors.map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {entityType === 'SPECIALIZATION' && selectedMajorId && (
                                    <div className="ser-field-group">
                                        <label className="ser-field-label">Chọn Chuyên ngành</label>
                                        <select
                                            className="ser-field-input"
                                            value={selectedSpecId}
                                            onChange={(e) => setSelectedSpecId(e.target.value)}
                                        >
                                            <option value="">-- Chọn Chuyên ngành --</option>
                                            {specializations.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {entityType === 'NARROW_SPEC' && selectedMajorId && (
                                    <>
                                        <div className="ser-field-group">
                                            <label className="ser-field-label">Chọn Chuyên ngành</label>
                                            <select
                                                className="ser-field-input"
                                                value={selectedSpecId}
                                                onChange={(e) => setSelectedSpecId(e.target.value)}
                                            >
                                                <option value="">-- Chọn Chuyên ngành --</option>
                                                {specializations.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedSpecId && (
                                            <div className="ser-field-group">
                                                <label className="ser-field-label">Chọn Chuyên ngành hẹp</label>
                                                <select
                                                    className="ser-field-input"
                                                    value={selectedNsId}
                                                    onChange={(e) => setSelectedNsId(e.target.value)}
                                                >
                                                    <option value="">-- Chọn Chuyên ngành hẹp --</option>
                                                    {narrowSpecs.map(n => (
                                                        <option key={n.id} value={n.id}>{n.name} ({n.code})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}

                                {entityType === 'ROADMAP' && (
                                    <div className="ser-field-group">
                                        <label className="ser-field-label">Chọn Lộ trình học tập của bạn</label>
                                        <select
                                            className="ser-field-input"
                                            value={selectedRoadmapId}
                                            onChange={(e) => setSelectedRoadmapId(e.target.value)}
                                        >
                                            <option value="">-- Chọn Lộ trình --</option>
                                            {roadmaps.map(r => (
                                                <option key={r.id} value={r.id}>{r.name || r.narrowSpecName || r.id}</option>
                                            ))}
                                        </select>
                                        {!roadmapsError && roadmaps.length === 0 && (
                                            <p className="ser-field-hint">Bạn chưa có lộ trình cá nhân nào để báo lỗi.</p>
                                        )}
                                    </div>
                                )}

                                {(entityType === 'COURSE' || entityType === 'RESOURCE') && (
                                    <>
                                        <div className="ser-field-group">
                                            <label className="ser-field-label">
                                                {entityType === 'RESOURCE'
                                                    ? 'Tìm kiếm Môn học chứa tài nguyên (Nhập mã hoặc tên môn)'
                                                    : 'Tìm kiếm Môn học (Nhập mã hoặc tên môn)'}
                                            </label>
                                            <input
                                                type="text"
                                                className="ser-field-input"
                                                placeholder="Ví dụ: MAD101, PRN211, Java..."
                                                value={courseFilter}
                                                onChange={(e) => {
                                                    setCourseFilter(e.target.value)
                                                    setSelectedCourseId('')
                                                }}
                                            />
                                        </div>
                                        {courseFilter.trim() && (
                                            <div className="ser-field-group">
                                                <label className="ser-field-label">Chọn Môn học kết quả</label>
                                                <select
                                                    className="ser-field-input"
                                                    value={selectedCourseId}
                                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                                    disabled={courseSearching || Boolean(coursesError)}
                                                >
                                                    <option value="">
                                                        {courseSearching ? 'Đang tìm...' : '-- Chọn Môn học --'}
                                                    </option>
                                                    {filteredCourses.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                                    ))}
                                                </select>
                                                {/* Phân biệt rõ ba trạng thái: đang tìm, tải hỏng, và thật sự
                                                    không có kết quả. Gộp chung khiến lỗi tải trông y hệt
                                                    "không có môn nào khớp". */}
                                                {coursesError ? (
                                                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                                                        {coursesError}
                                                    </p>
                                                ) : !courseSearching && filteredCourses.length === 0 ? (
                                                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                                                        Không tìm thấy môn học nào khớp với từ khóa
                                                    </p>
                                                ) : null}
                                            </div>
                                        )}

                                        {entityType === 'RESOURCE' && selectedCourseId && (
                                            <div className="ser-field-group">
                                                <label className="ser-field-label">Chọn Tài nguyên học tập</label>
                                                <select
                                                    className="ser-field-input"
                                                    value={selectedResourceId}
                                                    onChange={(e) => setSelectedResourceId(e.target.value)}
                                                >
                                                    <option value="">-- Chọn Tài nguyên --</option>
                                                    {resources.map(r => (
                                                        <option key={r.id} value={r.id}>{r.title}</option>
                                                    ))}
                                                </select>
                                                {resourcesError ? (
                                                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{resourcesError}</p>
                                                ) : resources.length === 0 && (
                                                    <p className="ser-field-hint">Môn học này chưa có tài nguyên học tập nào.</p>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* Xác nhận lại nội dung sắp báo. Không có bước này thì sau vài
                            lần đổi phân loại/dropdown rất dễ gửi nhầm mục khác. */}
                        {!stateData && (
                            <div className="ser-field-group">
                                <label className="ser-field-label">Nội dung sẽ báo lỗi</label>
                                <div className={`ser-target-box${entityId ? ' is-picked' : ''}`}>
                                    {entityId
                                        ? pageLabel
                                        : 'Chưa chọn — hãy chọn nội dung cụ thể ở các ô phía trên.'}
                                </div>
                            </div>
                        )}

                        <div className="ser-field-group">
                            <label className="ser-field-label">Mô tả lỗi</label>
                            <textarea
                                className="ser-field-textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Mô tả cụ thể lỗi bạn gặp phải: sai thông tin, hiển thị lỗi, liên kết hỏng..."
                                rows={6}
                                maxLength={DESC_MAX}
                            />
                            <p className="ser-field-hint ser-field-hint--right">{description.length}/{DESC_MAX}</p>
                        </div>

                        {error && <div className="ser-form-error">{error}</div>}

                        {/* Backend chưa có trường đồng ý tiết lộ danh tính -> không hứa điều form không làm được (DEF_168) */}
                        <p className="ser-privacy-note">
                            Danh tính của bạn không được hiển thị công khai. Báo cáo chỉ được dùng nội bộ để Content Manager
                            kiểm tra và xử lý nội dung.
                        </p>

                        <button className="ser-btn-primary ser-submit-btn" type="submit">Gửi báo cáo</button>
                    </form>
                )}
            </div>
        </Layout>
    )
}