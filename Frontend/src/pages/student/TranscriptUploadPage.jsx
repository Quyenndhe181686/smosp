import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, XCircle, FileSpreadsheet, FileText, Upload, SearchCode, Save, RotateCcw, BookOpen, Award, CheckCircle2, Clock, BookMarked } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import { getCourses } from '../../services/courseService'
import { uploadTranscript, getLatestTranscript, getStudentProfile } from '../../services/studentService'
import { ProfileFlowFooter, ProfileFlowAlert, ProfileFlowToast, ProfileIncompleteNotice } from '../../components/student/ProfileFlowNav'
import { refreshProfileFlow } from '../../components/student/profileFlow'
import './TranscriptUploadPage.css'
import step1 from '../../asset/step1.png'
import step2 from '../../asset/step2.png'
import step3 from '../../asset/step3.png'
import step4 from '../../asset/step4.png'

const MAX_FILE_MB = 5
const MAX_UPLOADS_PER_HOUR = 3
const ACCEPTED_EXT = ['.xlsx']

/* status: PASSED / FAILED / STUDYING / NOT_STARTED */
const STATUS_META = {
    PASSED: { label: 'Đã hoàn thành', bg: '#EDF9EC', fg: '#2E7D32' },
    FAILED: { label: 'Không đạt', bg: '#FDEDED', fg: '#C62828' },
    STUDYING: { label: 'Đang học', bg: '#EAF2FB', fg: '#034EA2' },
    NOT_STARTED: { label: 'Chưa học', bg: '#F1F2F5', fg: '#6b7280' },
}

const GUIDE_STEPS = [
    {
        img: step1,
        desc: 'Bước 1: Đăng nhập vào FAP và tìm mục Academic Transcript.'
    },
    {
        img: step2,
        desc: 'Bước 2: Kéo xuống cuối trang và nhấn Import To Excel.'
    },
    {
        img: step3,
        desc: 'Bước 3: Bật file và chọn Save As -> chọn đuôi file là xlsx.'
    },
    {
        img: step4,
        desc: 'Bước 4: Quay về trang upload bảng điểm và upload file vừa tải về.'
    }
]

// Grade input pattern: up to 2 integer digits, optional 1 decimal digit (e.g. "8", "8.5", "10")
const GRADE_INPUT_PATTERN = /^\d{0,2}(\.\d{0,1})?$/

export default function TranscriptUploadPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Sinh viên'
    const fileInputRef = useRef(null)

    const [allDbCourses, setAllDbCourses] = useState([])
    const [transcript, setTranscript] = useState(null)
    const [courses, setCourses] = useState([])

    const [selectedFile, setSelectedFile] = useState(null)
    const [tempTranscript, setTempTranscript] = useState(null)
    const [tempCourses, setTempCourses] = useState(null)
    const [uploadStatus, setUploadStatus] = useState('loading') // loading | idle | ready_to_analyze | uploading | analyzed | success | error
    const [errorMsg, setErrorMsg] = useState(null)
    const [uploadsThisHour, setUploadsThisHour] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [profileIncomplete, setProfileIncomplete] = useState(false)
    const [profileLoadFailed, setProfileLoadFailed] = useState(false)

    const [showGuide, setShowGuide] = useState(false)
    const [guideStep, setGuideStep] = useState(1)
    const [toast, setToast] = useState(null)

    // ── GPA simulation (trial only — nothing here is ever saved) ──────
    const [simulateMode, setSimulateMode] = useState(false)
    const [simEdits, setSimEdits] = useState({}) // { [courseCode]: rawInputString }

    useEffect(() => {
        if (showGuide) {
            setGuideStep(1)
        }
    }, [showGuide])

    const handleNextStep = useCallback(() => {
        setGuideStep(prev => Math.min(prev + 1, 4))
    }, [])

    const handlePrevStep = useCallback(() => {
        setGuideStep(prev => Math.max(prev - 1, 1))
    }, [])

    // Load initial courses and latest transcript
    useEffect(() => {
        const initLoad = async () => {
            try {
                const profile = await getStudentProfile()
                if (!profile.fullName || !profile.majorId || !profile.specializationId) {
                    setProfileIncomplete(true)
                }
                setProfileLoadFailed(false)
            } catch (err) {
                console.error("Failed to load student profile:", err)
                setProfileIncomplete(true)
                setProfileLoadFailed(true)
            }


            setAllDbCourses([])

            try {
                const latest = await getLatestTranscript()
                const mapped = mapGradesToCourses(latest.grades, [])
                setTranscript({
                    fileName: latest.fileName,
                    uploadedAt: formatTime(latest.uploadTime),
                    sizeKb: 0,
                    cumulativeGpa: latest.cumulativeGpa || 0
                })
                setCourses(mapped)
                setUploadStatus('idle')
            } catch (e) {
                if (e.response && e.response.status === 404) {
                    setTranscript({
                        fileName: 'Chưa có bảng điểm',
                        uploadedAt: '—',
                        sizeKb: 0,
                        cumulativeGpa: 0
                    })
                    setCourses([])
                    setUploadStatus('idle')
                } else {
                    console.error("Failed to load latest transcript:", e)
                    setUploadStatus('error')
                    const errMsg = 'Không thể tải thông tin bảng điểm từ máy chủ.'
                    setErrorMsg(errMsg)
                    setToast({ message: errMsg, type: 'error' })
                }
            }
        }

        initLoad()
    }, [])

    const formatTime = (timeStr) => {
        if (!timeStr) return '—'
        try {
            return new Date(timeStr).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        } catch (e) {
            return timeStr
        }
    }

    const mapGradesToCourses = (grades, dbCourses = []) => {
        if (!grades) return []
        const courseMap = new Map(dbCourses.map(c => [c.code, c]))
        const idMap = new Map(dbCourses.map(c => [c.id, c]))

        return grades.map(g => {
            const dbCourse = (g.courseId ? idMap.get(g.courseId) : null) || courseMap.get(g.courseCodeRaw)
            const name = g.courseName || dbCourse?.name || ''
            const termVal = g.term ?? dbCourse?.term
            const termStr = termVal ? `Kỳ ${termVal}` : '—'
            const credit = g.credits ?? dbCourse?.credits ?? 3
            const countsTowardGpa = g.countsTowardGpa ?? (dbCourse ? dbCourse.countsTowardGpa !== false : true)

            return {
                code: g.courseCode || g.courseCodeRaw,
                name: name,
                term: termStr,
                credit: credit,
                grade: g.grade,
                status: g.status,
                countsTowardGpa: countsTowardGpa
            }
        })
    }

    const activeTranscript = uploadStatus === 'analyzed' && tempTranscript ? tempTranscript : transcript
    const activeCourses = uploadStatus === 'analyzed' && tempCourses ? tempCourses : courses

    const completed = useMemo(() => activeCourses.filter((c) => c.status === 'PASSED').length, [activeCourses])
    const studying = useMemo(() => activeCourses.filter((c) => c.status === 'STUDYING').length, [activeCourses])

    // ── GPA simulation logic ───────────────────────────────────────────
    // Everything below only ever touches local component state (simEdits).
    // Nothing is sent to the server and nothing overwrites `courses`/`transcript`.
    const toggleSimulateMode = useCallback(() => {
        setSimulateMode(prev => {
            if (prev) setSimEdits({}) // leaving simulation clears all trial edits
            return !prev
        })
    }, [])

    const handleSimGradeChange = useCallback((code, value) => {
        if (value !== '' && !GRADE_INPUT_PATTERN.test(value)) return
        // Kẹp ngay khi nhập để ô hiển thị đúng giá trị đang được dùng để tính (DEF_116)
        let next = value
        const parsed = parseFloat(value)
        if (!isNaN(parsed)) {
            if (parsed > 10) next = '10'
            else if (parsed < 0) next = '0'
        }
        setSimEdits(prev => ({ ...prev, [code]: next }))
    }, [])

    const handleResetSimRow = useCallback((code) => {
        setSimEdits(prev => {
            const next = { ...prev }
            delete next[code]
            return next
        })
    }, [])

    const handleResetAllSim = useCallback(() => {
        setSimEdits({})
    }, [])

    // Effective (possibly trial) grade for a course: null/undefined-safe
    const getEffectiveGrade = useCallback((c) => {
        const raw = simEdits[c.code]
        if (raw === undefined || raw === '') return c.grade
        const parsed = parseFloat(raw)
        if (isNaN(parsed)) return c.grade
        return Math.min(10, Math.max(0, parsed))
    }, [simEdits])

    const hasSimEdits = Object.keys(simEdits).length > 0

    // Phải cùng công thức với calculateGpa (môn PASSED + countsTowardGpa) để khi chưa sửa gì
    // GPA mô phỏng bằng đúng GPA thật; môn đang học chỉ được tính khi Student tự nhập điểm thử (DEF_115)
    const simulatedGpa = useMemo(() => {
        if (!simulateMode) return null
        let totalPoints = 0
        let totalCredits = 0
        activeCourses.forEach((c) => {
            if (c.countsTowardGpa === false) return
            const edited = simEdits[c.code] !== undefined && simEdits[c.code] !== ''
            if (c.status !== 'PASSED' && !edited) return
            const g = getEffectiveGrade(c)
            if (g === null || g === undefined) return
            totalPoints += g * c.credit
            totalCredits += c.credit
        })
        return totalCredits > 0 ? (totalPoints / totalCredits) : 0
    }, [simulateMode, activeCourses, getEffectiveGrade, simEdits])

    const gpaDiff = (simulatedGpa !== null && activeTranscript)
        ? simulatedGpa - activeTranscript.cumulativeGpa
        : 0

    const validateFile = useCallback((file) => {
        if (file.size === 0) return 'File rỗng (0 byte). Vui lòng chọn file bảng điểm hợp lệ.'
        if (file.size > MAX_FILE_MB * 1024 * 1024) return `File vượt quá giới hạn ${MAX_FILE_MB}MB.`
        const lower = file.name.toLowerCase()
        if (!ACCEPTED_EXT.some((ext) => lower.endsWith(ext))) {
            return 'File không đúng định dạng Excel (.xlsx).'
        }
        return null
    }, [])

    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0]
        if (file) {
            const fileErr = validateFile(file)
            if (fileErr) {
                setUploadStatus('error')
                setErrorMsg(fileErr)
                setToast({ message: fileErr, type: 'error' })
                setSelectedFile(null)
            } else {
                setSelectedFile(file)
                setUploadStatus('ready_to_analyze')
                setErrorMsg(null)
            }
        }
        e.target.value = ''
    }, [validateFile])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) {
            const fileErr = validateFile(file)
            if (fileErr) {
                setUploadStatus('error')
                setErrorMsg(fileErr)
                setToast({ message: fileErr, type: 'error' })
                setSelectedFile(null)
            } else {
                setSelectedFile(file)
                setUploadStatus('ready_to_analyze')
                setErrorMsg(null)
            }
        }
    }, [validateFile])

    const handleCancelSelection = useCallback(() => {
        setSelectedFile(null)
        setUploadStatus('idle')
        setErrorMsg(null)
    }, [])

    const handleAnalyze = useCallback(async () => {
        if (!selectedFile) return

        if (uploadsThisHour >= MAX_UPLOADS_PER_HOUR) {
            const errStr = 'Bạn đã tải lên quá số lần cho phép (tối đa 3 lần/giờ). Vui lòng thử lại sau.'
            setUploadStatus('error')
            setErrorMsg(errStr)
            setToast({ message: errStr, type: 'error' })
            return
        }

        setUploadStatus('uploading')
        setErrorMsg(null)

        try {
            const res = await uploadTranscript(selectedFile)
            setUploadsThisHour((n) => n + 1)

            const mapped = mapGradesToCourses(res.grades, allDbCourses)
            setTempTranscript({
                fileName: res.fileName,
                uploadedAt: formatTime(res.uploadTime),
                sizeKb: Math.round(selectedFile.size / 1024),
                cumulativeGpa: res.cumulativeGpa || 0
            })
            setTempCourses(mapped)
            setUploadStatus('analyzed')
        } catch (err) {
            console.error("Failed to upload transcript:", err)
            setUploadStatus('error')
            const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi phân tích bảng điểm.'
            setErrorMsg(errMsg)
            setToast({ message: errMsg, type: 'error' })
        }
    }, [selectedFile, uploadsThisHour, allDbCourses])

    // POST /students/me/transcripts ở handleAnalyze đã ghi bảng điểm lên server, nên đây chỉ là
    // bước xác nhận đọc kết quả — không có request ghi thứ hai để phát (DEF_118).
    const handleSave = useCallback(() => {
        if (!tempTranscript || !tempCourses) return
        setTranscript(tempTranscript)
        setCourses(tempCourses)
        setUploadStatus('success')
        setToast({ message: 'Đã áp dụng bảng điểm mới vào hồ sơ học thuật!', type: 'success' })
        refreshProfileFlow() // cập nhật lại stepper của cả luồng
        setTempTranscript(null)
        setTempCourses(null)
        setSelectedFile(null)
        setTimeout(() => setUploadStatus('idle'), 2500)
    }, [tempTranscript, tempCourses])

    // "Bỏ xem trước" chỉ đóng khung xem trước; bảng điểm cũ KHÔNG khôi phục được vì lần
    // phân tích đã ghi đè trên server. Đọc lại trạng thái thật để màn khớp dữ liệu (DEF_114/DEF_118).
    const handleCancelAnalysis = useCallback(async () => {
        setTempTranscript(null)
        setTempCourses(null)
        setSelectedFile(null)
        setUploadStatus('loading')
        try {
            const latest = await getLatestTranscript()
            const mapped = mapGradesToCourses(latest.grades, allDbCourses)
            setTranscript({
                fileName: latest.fileName,
                uploadedAt: formatTime(latest.uploadTime),
                sizeKb: 0,
                cumulativeGpa: latest.cumulativeGpa || 0
            })
            setCourses(mapped)
        } catch (err) {
            console.error("Failed to reload transcript after cancel:", err)
        }
        setUploadStatus('idle')
        setToast({
            message: 'Đã đóng khung xem trước. Lưu ý: bảng điểm vừa tải lên đã thay thế bảng điểm cũ ngay từ bước phân tích.',
            type: 'error'
        })
        // Stepper phải refresh sau "Hủy" giống như sau "Lưu" (DEF_114)
        refreshProfileFlow()
    }, [allDbCourses])

    const openFileDialog = () => fileInputRef.current?.click()

    const handleLogout = async () => { await logout(); navigate('/login') }

    if (uploadStatus === 'loading') {
        return (
            <Layout role="student" user={{ name: username }} onLogout={handleLogout}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', fontSize: '15px', color: '#666' }}>
                    Đang tải dữ liệu học tập...
                </div>
            </Layout>
        )
    }

    return (
        <Layout
            role="student"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <ProfileFlowToast toast={toast} onClose={() => setToast(null)} />
            <div className="tr-page">
                <ProfileFlowFooter current="transcript" />

                <div className="tr-head">
                    <div>
                        <h1 className="tr-title">
                            <span className="tr-title-icon"><FileText size={20} strokeWidth={2.5} /></span>
                            Bảng điểm học thuật
                        </h1>
                    </div>
                    <button type="button" className="tr-guide-btn" onClick={() => setShowGuide(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F37021" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="tr-guide-icon" style={{ fill: '#FFE082' }}>
                            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5z" />
                            <path d="M9 18h6" />
                            <path d="M10 22h4" />
                        </svg>
                        Hướng dẫn tải lên bảng điểm
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    hidden
                    onChange={handleFileChange}
                />

                {/* ── Upload / current file card ─────────────────────── */}
                <div
                    className={`tr-card tr-upload-card${isDragging ? ' tr-dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <div className="tr-upload-left">
                        <div className="tr-upload-icon">
                            {uploadStatus === 'uploading' ? (
                                <span className="tr-spinner" />
                            ) : (
                                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                    <path d="M13 2v16" stroke="#F37021" strokeWidth="2" />
                                    <path d="M7 8l6-6 6 6" stroke="#F37021" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M3 19v3a2 2 0 002 2h16a2 2 0 002-2v-3" stroke="#F37021" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <p className="tr-file-name">
                                {uploadStatus === 'analyzed' && tempTranscript
                                    ? tempTranscript.fileName
                                    : (selectedFile ? selectedFile.name : (activeTranscript?.fileName || 'Chưa có bảng điểm'))
                                }
                            </p>
                            <p className="tr-file-meta">
                                {uploadStatus === 'analyzed' && tempTranscript
                                    ? `Đã phân tích · ${tempTranscript.sizeKb} KB`
                                    : (selectedFile
                                        ? `Đã tải lên · ${Math.round(selectedFile.size / 1024)} KB`
                                        : `Cập nhật lúc ${activeTranscript?.uploadedAt || '—'} · ${activeTranscript?.sizeKb || 0} KB`)
                                }
                            </p>
                            {uploadStatus === 'ready_to_analyze' && (
                                <span className="tr-badge tr-badge-warning">Chờ phân tích</span>
                            )}
                            {uploadStatus === 'analyzed' && (
                                // Bảng điểm đã được ghi ngay từ bước phân tích — không được gắn nhãn "Chưa lưu" (DEF_115)
                                <span className="tr-badge tr-badge-warning">Đã ghi nhận · đang xem trước kết quả</span>
                            )}
                            {uploadStatus === 'success' && (
                                <span className="tr-badge tr-badge-success">Đã phân tích &amp; lưu thành công</span>
                            )}
                            {uploadStatus === 'error' && (
                                <span className="tr-badge tr-badge-error">{errorMsg}</span>
                            )}
                            {uploadStatus === 'uploading' && (
                                <span className="tr-badge tr-badge-info">Đang xử lý file…</span>
                            )}
                        </div>
                    </div>
                    <div className="tr-upload-right">
                        {uploadStatus === 'ready_to_analyze' && (
                            <>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        className="tr-btn-secondary"
                                        onClick={handleCancelSelection}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <RotateCcw size={15} />
                                        Hủy
                                    </button>
                                    <button
                                        type="button"
                                        className="tr-btn-primary"
                                        onClick={handleAnalyze}
                                        disabled={profileIncomplete}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <SearchCode size={16} />
                                        Phân tích bảng điểm
                                    </button>
                                </div>
                                <p className="tr-upload-hint">Click Phân tích để xem trước kết quả điểm GPA và các môn học</p>
                            </>
                        )}
                        {uploadStatus === 'analyzed' && (
                            <>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        className="tr-btn-secondary"
                                        onClick={handleCancelAnalysis}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <RotateCcw size={15} />
                                        Bỏ xem trước
                                    </button>
                                    <button
                                        type="button"
                                        className="tr-btn-success"
                                        onClick={handleSave}
                                        disabled={profileIncomplete}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Save size={16} />
                                        Xác nhận kết quả
                                    </button>
                                </div>
                                <p className="tr-upload-hint">
                                    Bảng điểm đã được ghi nhận vào hồ sơ ngay khi phân tích. Bỏ xem trước sẽ đóng khung
                                    này nhưng <strong>không khôi phục</strong> được bảng điểm cũ.
                                </p>
                            </>
                        )}
                        {uploadStatus !== 'ready_to_analyze' && uploadStatus !== 'analyzed' && (
                            <>
                                <button
                                    type="button"
                                    className="tr-btn-primary"
                                    onClick={openFileDialog}
                                    disabled={uploadStatus === 'uploading' || profileIncomplete}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Upload size={16} />
                                    Tải lên bảng điểm mới
                                </button>
                                <p className="tr-upload-hint">
                                    Định dạng .xlsx · Tối đa {MAX_FILE_MB}MB · {MAX_UPLOADS_PER_HOUR - uploadsThisHour > 0
                                        ? `Còn ${MAX_UPLOADS_PER_HOUR - uploadsThisHour} lượt tải lên trong giờ này`
                                        : 'Đã hết lượt tải lên trong giờ này'}
                                </p>
                                {profileIncomplete && (
                                    <>
                                        {profileLoadFailed ? (
                                            <p className="tr-upload-hint" style={{ color: '#B91C1C', marginTop: '8px' }}>
                                                Không đọc được hồ sơ của bạn nên tạm khoá thao tác tải lên. Hãy tải lại trang rồi thử lại.
                                            </p>
                                        ) : (
                                            <ProfileIncompleteNotice style={{ marginTop: '8px', display: 'block' }} />
                                        )}
                                        {/* FDS yêu cầu 1 lối tắt sang màn khai báo thông tin cá nhân (DEF_117) */}
                                        {!profileLoadFailed && (
                                            <button
                                                type="button"
                                                className="tr-btn-secondary"
                                                onClick={() => navigate('/student/profile')}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}
                                            >
                                                Khai báo ngay
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── Stat cards ──────────────────────────────────────── */}
                <div className="tr-stats-row">
                    <div className="tr-card tr-stat-card tr-stat-card-gpa">
                        <span className="tr-stat-label">
                            <span className="tr-stat-icon tr-stat-icon--green"><Award size={14} strokeWidth={2.5} /></span> GPA
                        </span>
                        <span className="tr-stat-value tr-stat-green">
                            {activeTranscript ? activeTranscript.cumulativeGpa.toFixed(3) : '0.000'} <small>/ 10</small>
                        </span>
                    </div>
                    <div className="tr-card tr-stat-card tr-stat-card-completed">
                        <span className="tr-stat-label">
                            <span className="tr-stat-icon tr-stat-icon--blue"><CheckCircle2 size={14} strokeWidth={2.5} /></span> Môn đã hoàn thành
                        </span>
                        <span className="tr-stat-value tr-stat-blue">{completed} <small>môn</small></span>
                    </div>
                    <div className="tr-card tr-stat-card tr-stat-card-studying">
                        <span className="tr-stat-label">
                            <span className="tr-stat-icon tr-stat-icon--orange"><Clock size={14} strokeWidth={2.5} /></span> Môn đang học
                        </span>
                        <span className="tr-stat-value tr-stat-orange">{studying} <small>môn</small></span>
                    </div>
                    <div className="tr-card tr-stat-card tr-stat-card-total">
                        <span className="tr-stat-label">
                            <span className="tr-stat-icon tr-stat-icon--slate"><BookMarked size={14} strokeWidth={2.5} /></span> Tổng số môn
                        </span>
                        <span className="tr-stat-value">{activeCourses.length} <small>/ chương trình</small></span>
                    </div>
                </div>

                {/* ── GPA simulation banner (trial only, nothing is saved) ── */}
                {simulateMode && (
                    <div className="tr-card tr-sim-banner">
                        <div className="tr-sim-banner-left">
                            <span className="tr-badge tr-badge-warning tr-sim-badge">Chế độ thử điểm — không lưu</span>
                            <p className="tr-sim-note">
                                Nhập điểm giả định trực tiếp vào cột "Điểm" trong bảng bên dưới để xem GPA thay đổi ra sao.
                                Kết quả chỉ hiển thị tạm thời trên màn hình này, không được lưu vào hồ sơ học tập của bạn.
                                Các môn được đánh dấu <strong>"Không tính GPA"</strong> sẽ không ảnh hưởng đến kết quả dù bạn nhập điểm gì.
                            </p>
                        </div>
                        <div className="tr-sim-banner-right">
                            <div className="tr-sim-gpa-box">
                                <span className="tr-sim-gpa-label">GPA giả định</span>
                                <span className="tr-sim-gpa-value">
                                    {simulatedGpa !== null ? simulatedGpa.toFixed(3) : '0.000'} <small>/ 10</small>
                                </span>
                                {hasSimEdits && (
                                    <span className={`tr-sim-gpa-diff${gpaDiff >= 0 ? ' tr-sim-gpa-diff-up' : ' tr-sim-gpa-diff-down'}`}>
                                        {gpaDiff >= 0 ? '+' : ''}{gpaDiff.toFixed(3)}
                                    </span>
                                )}
                            </div>
                            {hasSimEdits && (
                                <button type="button" className="tr-btn-secondary tr-sim-reset-btn" onClick={handleResetAllSim}>
                                    Đặt lại tất cả
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Course table ────────────────────────────────────── */}
                <div className="tr-card tr-table-card">
                    <div className="tr-table-head">
                        <h2 className="tr-table-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={20} style={{ color: '#034EA2' }} />
                            Danh sách môn học
                        </h2>
                        <div className="tr-table-head-actions">
                            <span className="tr-table-count">Hiển thị {activeCourses.length} môn</span>
                            <button
                                type="button"
                                className={`tr-sim-toggle-btn${simulateMode ? ' active' : ''}`}
                                onClick={toggleSimulateMode}
                                disabled={uploadStatus === 'uploading'}
                            >
                                {simulateMode ? (
                                    <>
                                        <XCircle size={18} className="tr-sim-btn-icon" />
                                        <span>Thoát chế độ thử điểm</span>
                                    </>
                                ) : (
                                    <>
                                        <Calculator size={18} className="tr-sim-btn-icon" />
                                        <span>Thử tính GPA</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="tr-table-scroll">
                        <table className="tr-table">
                            <thead>
                                <tr>
                                    <th>Mã môn</th>
                                    <th>Tên môn học</th>
                                    <th>Tín chỉ</th>
                                    <th>Điểm{simulateMode ? ' (thử)' : ''}</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeCourses.map((c) => {
                                    const meta = STATUS_META[c.status]
                                    const rawEdit = simEdits[c.code]
                                    const isEdited = rawEdit !== undefined && rawEdit !== ''
                                    const isCountedInGpa = c.countsTowardGpa !== false && (c.status === 'PASSED' || isEdited)
                                    const rowClass = simulateMode
                                        ? (isCountedInGpa ? 'tr-row-gpa-included' : 'tr-row-gpa-excluded')
                                        : ''

                                    return (
                                        <tr key={c.code} className={rowClass}>
                                            <td className="tr-code">{c.code}</td>
                                            <td>
                                                {c.name}
                                                {c.countsTowardGpa === false && (
                                                    <span className="tr-no-gpa-tag" title="Môn này không được tính vào GPA tích lũy">
                                                        Không tính GPA
                                                    </span>
                                                )}
                                            </td>
                                            <td>{c.credit}</td>
                                            <td className={!simulateMode && c.grade == null ? 'tr-grade-empty' : ''}>
                                                {simulateMode ? (
                                                    c.countsTowardGpa === false ? (
                                                        <input
                                                            type="text"
                                                            className="tr-sim-grade-input"
                                                            value={c.grade != null ? c.grade.toFixed(1) : '—'}
                                                            disabled
                                                            title="Môn này không tính vào GPA nên không thể thử điểm"
                                                        />
                                                    ) : (
                                                        <div className="tr-sim-grade-cell">
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                className={`tr-sim-grade-input${isEdited ? ' edited' : ''}`}
                                                                placeholder={c.grade != null ? c.grade.toFixed(1) : '—'}
                                                                value={rawEdit ?? ''}
                                                                onChange={(e) => handleSimGradeChange(c.code, e.target.value)}
                                                            />
                                                            {isEdited && (
                                                                <button
                                                                    type="button"
                                                                    className="tr-sim-clear-btn"
                                                                    title="Đặt lại điểm gốc"
                                                                    onClick={() => handleResetSimRow(c.code)}
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                ) : (
                                                    c.grade != null ? c.grade.toFixed(1) : '—'
                                                )}
                                            </td>
                                            <td>
                                                <span className="tr-status-pill" style={{ background: meta.bg, color: meta.fg }}>
                                                    {meta.label}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showGuide && (
                <div className="tr-guide-modal-overlay" onClick={() => setShowGuide(false)}>
                    <div className="tr-guide-modal" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="tr-guide-close" onClick={() => setShowGuide(false)}>&times;</button>

                        <h2 className="tr-guide-modal-title">Hướng dẫn tải lên bảng điểm</h2>

                        {/* Step indicators */}
                        <div className="tr-guide-steps-progress">
                            {[1, 2, 3, 4].map((stepNum) => (
                                <div
                                    key={stepNum}
                                    className={`tr-guide-step-dot${guideStep === stepNum ? ' active' : ''}${guideStep > stepNum ? ' completed' : ''}`}
                                    onClick={() => setGuideStep(stepNum)}
                                >
                                    {stepNum}
                                </div>
                            ))}
                        </div>

                        {/* Step Content */}
                        <div className="tr-guide-content">
                            <div className="tr-guide-image-container">
                                <img
                                    src={GUIDE_STEPS[guideStep - 1].img}
                                    alt={`Bước ${guideStep}`}
                                    className="tr-guide-img"
                                />
                            </div>
                            <div className="tr-guide-step-info">
                                <span className="tr-guide-step-badge">Bước {guideStep} / 4</span>
                                <p className="tr-guide-step-desc">
                                    {GUIDE_STEPS[guideStep - 1].desc}
                                </p>
                            </div>
                        </div>

                        {/* Footer navigation */}
                        <div className="tr-guide-footer">
                            <button
                                type="button"
                                className="tr-btn-secondary"
                                onClick={handlePrevStep}
                                disabled={guideStep === 1}
                            >
                                Quay lại
                            </button>
                            {guideStep < 4 ? (
                                <button
                                    type="button"
                                    className="tr-btn-primary"
                                    onClick={handleNextStep}
                                >
                                    Tiếp theo
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="tr-btn-success"
                                    onClick={() => setShowGuide(false)}
                                >
                                    Hoàn thành
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}