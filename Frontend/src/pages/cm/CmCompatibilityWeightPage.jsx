import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Sliders, SlidersHorizontal, Save, Undo2, History, User, Store } from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmCatalogFilter from '../../components/cm/CmCatalogFilter'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import {
    getMajors,
    getSpecializationsByMajor,
    getNarrowSpecsBySpecialization,
    getWeightConfig,
    updateWeightConfig,
    getWeightConfigAudit
} from '../../services/catalogService'
import { getCurrentTrendingWeights } from '../../services/crawlerService'
import './CmCompatibilityWeightPage.css'

const ALPHA_MIN = 0.01
const ALPHA_MAX = 0.99

const PROFILE_KEYS = ['wGpa', 'wSkill', 'wInt']
const PROFILE_LABEL = { wGpa: 'Điểm học tập', wSkill: 'Kỹ năng', wInt: 'Sở thích' }
const PROFILE_DEFAULT = { wGpa: 0.4, wSkill: 0.35, wInt: 0.25 }

/* AC-57-01/DC-03 (áp dụng riêng cho nhóm hồ sơ cá nhân): đổi 1 trong 3 w_*
   thì 2 cái còn lại re-scale theo đúng tỷ lệ hiện có, tổng luôn = 1.0.
   alpha_base KHÔNG nằm trong nhóm rescale này — là thanh trượt độc lập. */
function rescaleProfileWeights(weights, changedKey, newValue) {
    const parsed = parseFloat(newValue)
    if (isNaN(parsed)) return weights

    const clamped = Number(Math.min(0.98, Math.max(0.01, parsed)).toFixed(2))
    const otherKeys = PROFILE_KEYS.filter((k) => k !== changedKey)
    const remaining = Number((1.0 - clamped).toFixed(2))

    const otherTotal = otherKeys.reduce((sum, k) => sum + Math.max(0, weights[k] || 0), 0)
    const result = { ...weights, [changedKey]: clamped }

    if (otherTotal <= 0.0001) {
        const equalShare = Number((remaining / otherKeys.length).toFixed(2))
        otherKeys.forEach((k, idx) => {
            if (idx === otherKeys.length - 1) {
                const usedSoFar = otherKeys.slice(0, idx).reduce((sum, kk) => sum + result[kk], 0)
                result[k] = Number((remaining - usedSoFar).toFixed(2))
            } else {
                result[k] = equalShare
            }
        })
    } else {
        let allocatedSoFar = 0
        otherKeys.forEach((k, idx) => {
            if (idx === otherKeys.length - 1) {
                const lastVal = Number((remaining - allocatedSoFar).toFixed(2))
                result[k] = Math.max(0.01, lastVal)
            } else {
                let ratio = weights[k] / otherTotal
                let val = Number((ratio * remaining).toFixed(2))
                if (val < 0.01 && remaining >= 0.01 * otherKeys.length) {
                    val = 0.01
                }
                result[k] = val
                allocatedSoFar += val
            }
        })

        const currentSum = PROFILE_KEYS.reduce((sum, k) => sum + result[k], 0)
        const diff = Number((1.0 - currentSum).toFixed(2))
        if (Math.abs(diff) >= 0.01) {
            const targetOtherKey = otherKeys.reduce((maxK, k) => (result[k] > result[maxK] ? k : maxK), otherKeys[0])
            result[targetOtherKey] = Number((result[targetOtherKey] + diff).toFixed(2))
        }
    }

    return result
}

/* Máy chủ trả/nhận tên trường viết liền chữ thường (wgpa, wskill, wint, wsacc,
   wsvol, wjunior) — KHÔNG phải camelCase. Hai hàm dưới đây là lớp chuyển đổi
   duy nhất, để phần còn lại của component vẫn dùng camelCase cho dễ đọc. */
function fromApiConfig(config) {
    return {
        alphaBase: Number(config.alphaBase ?? 0.5),
        wGpa: (config.wgpa != null ? Number(config.wgpa) : (config.wGpa != null ? Number(config.wGpa) : 0.4)),
        wSkill: (config.wskill != null ? Number(config.wskill) : (config.wSkill != null ? Number(config.wSkill) : 0.35)),
        wInt: (config.wint != null ? Number(config.wint) : (config.wInt != null ? Number(config.wInt) : 0.25)),
        wSacc: (config.wsacc != null ? Number(config.wsacc) : (config.wSacc != null ? Number(config.wSacc) : 0.5)),
        wSvol: (config.wsvol != null ? Number(config.wsvol) : (config.wSvol != null ? Number(config.wSvol) : 0.3)),
        wJunior: (config.wjunior != null ? Number(config.wjunior) : (config.wJunior != null ? Number(config.wJunior) : 0.2)),
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy
    }
}

function toApiPayload(draftConfig, note) {
    return {
        alphaBase: draftConfig.alphaBase,
        wgpa: draftConfig.wGpa,
        wskill: draftConfig.wSkill,
        wint: draftConfig.wInt,
        wGpa: draftConfig.wGpa,
        wSkill: draftConfig.wSkill,
        wInt: draftConfig.wInt,
        wsacc: draftConfig.wSacc ?? 0.5,
        wsvol: draftConfig.wSvol ?? 0.3,
        wjunior: draftConfig.wJunior ?? 0.2,
        wSacc: draftConfig.wSacc ?? 0.5,
        wSvol: draftConfig.wSvol ?? 0.3,
        wJunior: draftConfig.wJunior ?? 0.2,
        note
    }
}

function mapAuditItem(item, nsId, idx) {
    return {
        id: `${nsId}-audit-${idx}`,
        changedAt: item.changedAt ? new Date(item.changedAt).toLocaleString('vi-VN') : '—',
        alphaBaseOld: Number(item.alphaBaseOld),
        alphaBaseNew: Number(item.alphaBaseNew),
        wGpaOld: Number(item.wgpaOld),
        wGpaNew: Number(item.wgpaNew),
        wSkillOld: Number(item.wskillOld),
        wSkillNew: Number(item.wskillNew),
        wIntOld: Number(item.wintOld),
        wIntNew: Number(item.wintNew),
        changedBy: item.changedBy || '—',
        note: item.note || ''
    }
}

/** Cặp giá trị cũ → mới trong bảng lịch sử */
function AuditDelta({ from, to }) {
    const changed = Math.abs(to - from) >= 0.005
    return (
        <span className={`nsw-audit-delta${changed ? ' is-changed' : ''}`}>
            {from.toFixed(2)} → <strong>{to.toFixed(2)}</strong>
        </span>
    )
}

export default function CmNarrowSpecWeightConfigPage() {
    const navigate = useNavigate()
    const username = localStorage.getItem('username') || 'Content Manager'
    const { toasts, showToast, dismissToast } = useCmToast()

    const [majors, setMajors] = useState([])
    const [specializations, setSpecializations] = useState([])
    const [narrowSpecs, setNarrowSpecs] = useState([])

    const [selectedMajorId, setSelectedMajorId] = useState('')
    const [selectedSpecId, setSelectedSpecId] = useState('')
    const [selectedNsId, setSelectedNsId] = useState('')

    const [draftConfig, setDraftConfig] = useState(null)
    const [savedConfig, setSavedConfig] = useState(null)
    const [history, setHistory] = useState([])
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [trendingWeightsMap, setTrendingWeightsMap] = useState({})

    /* Trọng số thị trường hiện hành của mọi chuyên ngành hẹp — một request duy
       nhất, tra cứu tại chỗ khi CM đổi lựa chọn. */
    useEffect(() => {
        getCurrentTrendingWeights()
            .then(data => {
                const map = {}
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        if (item.narrowSpecId) map[item.narrowSpecId] = item.currentTw
                        if (item.narrowSpecCode) map[item.narrowSpecCode] = item.currentTw
                    })
                }
                setTrendingWeightsMap(map)
            })
            .catch(err => console.error('Không tải được trọng số thị trường:', err))
    }, [])

    useEffect(() => {
        getMajors()
            .then(data => setMajors(data.filter(m => m.isActive)))
            .catch(err => console.error('Không tải được danh sách ngành:', err))
    }, [])

    useEffect(() => {
        if (!selectedMajorId) return
        getSpecializationsByMajor(selectedMajorId)
            .then(data => setSpecializations(data.filter(s => s.isActive)))
            .catch(err => console.error('Không tải được danh sách chuyên ngành:', err))
    }, [selectedMajorId])

    useEffect(() => {
        if (!selectedSpecId) return
        getNarrowSpecsBySpecialization(selectedSpecId)
            .then(setNarrowSpecs)
            .catch(err => console.error('Không tải được danh sách chuyên ngành hẹp:', err))
    }, [selectedSpecId])

    useEffect(() => {
        if (!selectedNsId) return

        getWeightConfig(selectedNsId)
            .then(config => {
                const mapped = fromApiConfig(config)
                setDraftConfig(mapped)
                setSavedConfig(mapped)
            })
            .catch(err => console.error('Không tải được cấu hình trọng số:', err))

        getWeightConfigAudit(selectedNsId, 0, 100)
            .then(pageData => {
                const content = pageData.content || []
                setHistory(content.map((item, idx) => mapAuditItem(item, selectedNsId, idx)))
            })
            .catch(err => console.error('Không tải được lịch sử thay đổi:', err))
    }, [selectedNsId])

    /* Đổi cấp trên thì dọn luôn cấp dưới ngay trong handler */
    const handleMajorChange = (value) => {
        setSelectedMajorId(value)
        setSelectedSpecId('')
        setSelectedNsId('')
        setSpecializations([])
        setNarrowSpecs([])
        setDraftConfig(null)
        setSavedConfig(null)
        setHistory([])
    }

    const handleSpecChange = (value) => {
        setSelectedSpecId(value)
        setSelectedNsId('')
        setNarrowSpecs([])
        setDraftConfig(null)
        setSavedConfig(null)
        setHistory([])
    }

    const handleNsChange = (value) => {
        setSelectedNsId(value)
        setNote('')
        if (!value) {
            setDraftConfig(null)
            setSavedConfig(null)
            setHistory([])
        }
    }

    const selectedNs = useMemo(
        () => narrowSpecs.find(n => n.id === selectedNsId) || null,
        [narrowSpecs, selectedNsId]
    )

    const isDirty = useMemo(() => {
        if (!savedConfig || !draftConfig) return false
        return (
            draftConfig.alphaBase !== savedConfig.alphaBase ||
            PROFILE_KEYS.some((k) => draftConfig[k] !== savedConfig[k])
        )
    }, [draftConfig, savedConfig])

    const handleAlphaChange = (value) => {
        const clamped = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, Number(value)))
        setDraftConfig((prev) => ({ ...prev, alphaBase: clamped }))
    }

    const handleProfileWeightChange = (key, value) => {
        setDraftConfig((prev) => rescaleProfileWeights(prev, key, Number(value)))
    }

    const handleReset = () => {
        setDraftConfig(savedConfig)
        setNote('')
        showToast('Đã hoàn tác về cấu hình đang lưu', 'info')
    }

    const handleSave = () => {
        if (!selectedNsId || !draftConfig) return
        setSaving(true)
        updateWeightConfig(selectedNsId, toApiPayload(draftConfig, note))
            .then(updated => {
                const mapped = fromApiConfig(updated)
                setSavedConfig(mapped)
                setDraftConfig(mapped)
                setNote('')
                showToast(`Đã lưu cấu hình trọng số cho ${selectedNs?.name}`)
                return getWeightConfigAudit(selectedNsId, 0, 100)
            })
            .then(pageData => {
                if (!pageData) return
                const content = pageData.content || []
                setHistory(content.map((item, idx) => mapAuditItem(item, selectedNsId, idx)))
            })
            .catch(err => {
                console.error('Không lưu được cấu hình trọng số:', err)
                showToast(err.response?.data?.message || 'Có lỗi xảy ra khi lưu cấu hình', 'error')
            })
            .finally(() => setSaving(false))
    }

    const handleLogout = async () => { await logout(); navigate('/login') }

    const currentTw = useMemo(() => {
        if (!selectedNsId) return null
        return trendingWeightsMap[selectedNsId]
            ?? (selectedNs ? trendingWeightsMap[selectedNs.code] : null)
            ?? selectedNs?.currentTw
            ?? selectedNs?.trendingWeight
            ?? null
    }, [selectedNsId, selectedNs, trendingWeightsMap])

    const hasTw = currentTw !== undefined && currentTw !== null
    const formattedTw = hasTw ? Number(currentTw).toFixed(2) : 'Chưa có'

    const profileTotal = draftConfig ? PROFILE_KEYS.reduce((sum, k) => sum + draftConfig[k], 0) : 0
    const totalOk = Math.abs(profileTotal - 1) < 0.005

    const alphaValue = draftConfig ? draftConfig.alphaBase : 0.5
    const marketShare = Math.round((1 - alphaValue) * 100)
    const profileShare = 100 - marketShare

    return (
        <Layout
            role="cm"
            user={{ name: username }}
            onLogout={handleLogout}
            onLogoClick={() => navigate('/')}
            onGoHome={() => navigate('/')}
        >
            <div className="nsw-page">
                <header className="cm-page-head">
                    <div className="cm-page-head-main">
                        <span className="cm-page-head-icon"><Sliders size={19} strokeWidth={2.2} /></span>
                        <div>
                            <h1 className="cm-page-title">Trọng số điểm phù hợp</h1>
                            <p className="cm-page-sub">
                                Điều chỉnh tỷ trọng giữa hồ sơ cá nhân và dữ liệu thị trường cho từng chuyên ngành hẹp
                            </p>
                        </div>
                    </div>
                </header>

                <CmCatalogFilter
                    majors={majors}
                    selectedMajorId={selectedMajorId}
                    onMajorChange={handleMajorChange}
                    specs={specializations}
                    selectedSpecId={selectedSpecId}
                    onSpecChange={handleSpecChange}
                    narrowSpecs={narrowSpecs}
                    selectedNsId={selectedNsId}
                    onNsChange={handleNsChange}
                />

                <div className="nsw-layout">
                    {/* ── Biểu mẫu điều chỉnh ── */}
                    <section className="nsw-card">
                        <div className="nsw-card-head">
                            <h2 className="nsw-section-title">
                                {selectedNs ? selectedNs.name : 'Chưa chọn chuyên ngành hẹp'}
                            </h2>
                            <p className="nsw-section-hint">
                                {selectedNs
                                    ? (savedConfig && savedConfig.updatedAt
                                        ? `Cấu hình gần nhất do ${savedConfig.updatedBy || 'quản trị nội dung'} lưu lúc ${new Date(savedConfig.updatedAt).toLocaleString('vi-VN')}`
                                        : 'Chưa có cấu hình riêng — đang hiển thị giá trị mặc định')
                                    : 'Chọn chuyên ngành hẹp ở thanh lọc phía trên để chỉnh sửa và lưu cấu hình'}
                            </p>
                        </div>

                        {/* Cán cân hồ sơ cá nhân ↔ thị trường */}
                        <div className="nsw-block">
                            <div className="nsw-slider-head">
                                <span className="nsw-slider-label">
                                    Cán cân hồ sơ cá nhân và thị trường
                                    <span className="nsw-code-hint">(alpha_base)</span>
                                </span>
                                <input
                                    type="number"
                                    min={ALPHA_MIN}
                                    max={ALPHA_MAX}
                                    step={0.01}
                                    className="nsw-num-input"
                                    value={alphaValue}
                                    disabled={!selectedNs}
                                    onChange={(e) => handleAlphaChange(e.target.value)}
                                />
                            </div>

                            <input
                                className="nsw-slider"
                                type="range"
                                min={ALPHA_MIN}
                                max={ALPHA_MAX}
                                step={0.01}
                                value={alphaValue}
                                disabled={!selectedNs}
                                onChange={(e) => handleAlphaChange(e.target.value)}
                            />

                            <div className="nsw-scale">
                                <span className="nsw-scale-end nsw-scale-end--market">
                                    <Store size={12} strokeWidth={2.4} /> Thị trường {marketShare}%
                                </span>
                                <span className="nsw-scale-end nsw-scale-end--profile">
                                    <User size={12} strokeWidth={2.4} /> Hồ sơ cá nhân {profileShare}%
                                </span>
                            </div>
                        </div>

                        {/* Chỉ số thị trường hiện hành */}
                        <div className="nsw-market-box">
                            <div className="nsw-market-top">
                                <span className="nsw-market-label">
                                    <Flame size={14} strokeWidth={2.4} /> Điểm thị trường hiện tại
                                </span>
                                <span className={`nsw-market-value${hasTw ? '' : ' is-empty'}`}>
                                    {hasTw ? `${formattedTw} / 100` : 'Chưa có dữ liệu'}
                                </span>
                            </div>
                            <div className="nsw-market-grid">
                                <div className="nsw-market-cell">
                                    <span className="nsw-market-cell-label">Tần suất tuyển dụng</span>
                                    <strong>{draftConfig?.wSacc ?? 0.5}</strong>
                                </div>
                                <div className="nsw-market-cell">
                                    <span className="nsw-market-cell-label">Quy mô tuyển dụng</span>
                                    <strong>{draftConfig?.wSvol ?? 0.3}</strong>
                                </div>
                                <div className="nsw-market-cell">
                                    <span className="nsw-market-cell-label">Tỷ lệ vị trí mới ra trường</span>
                                    <strong>{draftConfig?.wJunior ?? 0.2}</strong>
                                </div>
                            </div>
                        </div>

                        <hr className="nsw-divider" />

                        {/* Tỷ trọng trong hồ sơ cá nhân */}
                        <div className="nsw-block">
                            <h3 className="nsw-block-title">
                                Tỷ trọng bên trong hồ sơ cá nhân
                                <span className="nsw-code-hint">(tổng phải bằng 1.00)</span>
                            </h3>

                            {PROFILE_KEYS.map((key) => (
                                <div className="nsw-slider-row" key={key}>
                                    <div className="nsw-slider-head">
                                        <span className="nsw-slider-label">{PROFILE_LABEL[key]}</span>
                                        <input
                                            type="number"
                                            min={0.01}
                                            max={0.98}
                                            step={0.01}
                                            className="nsw-num-input"
                                            value={draftConfig ? draftConfig[key] : PROFILE_DEFAULT[key]}
                                            disabled={!selectedNs}
                                            onChange={(e) => handleProfileWeightChange(key, e.target.value)}
                                        />
                                    </div>
                                    <input
                                        className="nsw-slider"
                                        type="range"
                                        min={0.01}
                                        max={0.98}
                                        step={0.01}
                                        value={draftConfig ? draftConfig[key] : PROFILE_DEFAULT[key]}
                                        disabled={!selectedNs}
                                        onChange={(e) => handleProfileWeightChange(key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="nsw-field">
                            <label className="nsw-field-label" htmlFor="nsw-note">
                                Ghi chú thay đổi (không bắt buộc)
                            </label>
                            <input
                                id="nsw-note"
                                className="nsw-field-input"
                                value={note}
                                disabled={!selectedNs}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Ví dụ: cân bằng lại theo phản hồi của khoa"
                            />
                        </div>

                        <div className="nsw-actions">
                            <span className={`cm-tag ${totalOk ? 'cm-tag--green' : 'cm-tag--red'}`}>
                                Tổng tỷ trọng: {profileTotal.toFixed(2)}
                            </span>
                            <div className="nsw-actions-buttons">
                                <button
                                    type="button"
                                    className="cm-btn cm-btn--secondary"
                                    onClick={handleReset}
                                    disabled={!isDirty || !selectedNs || saving}
                                >
                                    <Undo2 size={14} strokeWidth={2.4} /> Hoàn tác
                                </button>
                                <button
                                    type="button"
                                    className="cm-btn cm-btn--primary"
                                    onClick={handleSave}
                                    disabled={!isDirty || !selectedNs || saving}
                                >
                                    <Save size={14} strokeWidth={2.4} />
                                    {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── Lịch sử thay đổi ── */}
                    <section className="nsw-card">
                        <div className="nsw-card-head">
                            <h2 className="nsw-section-title">
                                <History size={16} strokeWidth={2.3} /> Lịch sử thay đổi
                            </h2>
                            <p className="nsw-section-hint">
                                {selectedNs
                                    ? `Các lần điều chỉnh trọng số của ${selectedNs.name}`
                                    : 'Chọn chuyên ngành hẹp để xem lịch sử điều chỉnh'}
                            </p>
                        </div>

                        <div className="nsw-table-wrap">
                            <table className="nsw-table">
                                <thead>
                                    <tr>
                                        <th>Thời điểm</th>
                                        <th>Cán cân</th>
                                        <th>Điểm học tập</th>
                                        <th>Kỹ năng</th>
                                        <th>Sở thích</th>
                                        <th>Người thực hiện</th>
                                        <th>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((h) => (
                                        <tr key={h.id}>
                                            <td className="nsw-muted nsw-nowrap">{h.changedAt}</td>
                                            <td><AuditDelta from={h.alphaBaseOld} to={h.alphaBaseNew} /></td>
                                            <td><AuditDelta from={h.wGpaOld} to={h.wGpaNew} /></td>
                                            <td><AuditDelta from={h.wSkillOld} to={h.wSkillNew} /></td>
                                            <td><AuditDelta from={h.wIntOld} to={h.wIntNew} /></td>
                                            <td className="nsw-muted">{h.changedBy}</td>
                                            <td className="nsw-muted">{h.note || '—'}</td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="nsw-empty">
                                                {selectedNs
                                                    ? 'Chuyên ngành hẹp này chưa có lần điều chỉnh nào'
                                                    : 'Chưa chọn chuyên ngành hẹp'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>

            <CmToast toasts={toasts} onDismiss={dismissToast} />
        </Layout>
    )
}
