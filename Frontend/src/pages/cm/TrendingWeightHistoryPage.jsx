import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, ArrowLeft, RefreshCw, FilterX, ChevronDown, Undo2, Search
} from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmPagination from '../../components/cm/CmPagination'
import { getMajors, getSpecializationsByMajor } from '../../services/catalogService'
import {
  getTrendingWeightProposals,
  getCrawlBatches,
  rollbackTrendingWeight,
  rollbackTrendingWeightBatch
} from '../../services/crawlerService'
import './TrendingWeightPage.css'

const toArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []))

function truncate(str, len = 26) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

/**
 * Gom nhóm danh sách mục theo đợt (các mục tạo cách nhau <= 90s thuộc cùng 1 đợt tính).
 */
function getBatchGroups(items) {
  if (!items || items.length === 0) return []

  const sorted = [...items].sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0))
  const batches = []

  sorted.forEach(item => {
    const t = item.rawDate || Date.now()
    let batch = batches.find(b => Math.abs(b.rawDate - t) <= 90000)
    if (!batch) {
      const date = new Date(t)
      const pad = (n) => String(n).padStart(2, '0')
      const dateStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
      batch = {
        id: `batch-${t}`,
        dateStr,
        rawDate: t,
        items: []
      }
      batches.push(batch)
    }
    batch.items.push(item)
  })

  return batches.map(batch => {
    const performers = [...new Set(batch.items.map(i => i.createdBy || i.approvedBy || i.reviewedBy).filter(Boolean))]
    const performerText = performers.length > 0 ? ` bởi ${performers.join(', ')}` : ''
    return {
      ...batch,
      performer: performers.join(', ') || '',
      label: `Đợt ${batch.dateStr}${performerText} (${batch.items.length} CNH)`
    }
  })
}

export default function TrendingWeightHistoryPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Content Manager'
  const aliveRef = useRef(true)

  const [loading, setLoading] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('LATEST')
  const [filterAnomaly, setFilterAnomaly] = useState('ALL')
  const [majors, setMajors] = useState([])
  const [specs, setSpecs] = useState([])
  const [majorId, setMajorId] = useState('')
  const [selectedSpecIds, setSelectedSpecIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const specDropdownRef = useRef(null)
  const specNameRef = useRef(new Map())
  const nsMapRef = useRef(new Map())

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Close multi-select dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (specDropdownRef.current && !specDropdownRef.current.contains(e.target)) {
        setSpecDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch majors on mount
  useEffect(() => {
    getMajors()
      .then(res => setMajors(toArray(res)))
      .catch(() => setMajors([]))
  }, [])

  // Fetch specializations when major changes
  useEffect(() => {
    if (!majorId) {
      setSpecs([])
      return
    }
    getSpecializationsByMajor(majorId)
      .then(res => {
        const list = toArray(res)
        setSpecs(list)
        list.forEach(s => specNameRef.current.set(s.id, s.name))
      })
      .catch(() => setSpecs([]))
  }, [majorId])

  // Fetch history list
  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const [acceptedData, batchesData] = await Promise.all([
        getTrendingWeightProposals('ACCEPTED').catch(() => []),
        getCrawlBatches().catch(() => [])
      ])

      const batchList = toArray(batchesData)
      const batchUserMap = new Map()
      batchList.forEach(b => {
        const userName = b.triggeredByName || b.triggeredBy || b.createdBy
        if (b.id && userName) batchUserMap.set(b.id, userName)
        if (b.batchCode && userName) batchUserMap.set(b.batchCode, userName)
      })

      const mapItem = (item) => {
        if (!item) return null
        const nsId = item.narrowSpecId || item.nsId || ''
        const nsInfo = nsMapRef.current.get(nsId) || {}
        const code = item.narrowSpecCode || item.nsCode || nsInfo.nsCode || ''
        const name = item.narrowSpecName || item.nsName || nsInfo.nsName || ''
        let displayName = ''
        if (code && name) {
          displayName = `[${code}] ${name}`
        } else if (code) {
          displayName = code
        } else if (name) {
          displayName = name
        } else {
          displayName = nsId ? `CNH ${nsId.slice(0, 8)}` : 'Narrow Spec'
        }

        const bCode = item.batchCode || item.crawlBatchId || ''
        let performer = bCode ? batchUserMap.get(bCode) : null
        if (!performer && item.createdAt) {
          const itemTime = new Date(item.createdAt).getTime()
          batchList.forEach(b => {
            if (!performer && (b.finishedAt || b.startedAt) && (b.triggeredByName || b.triggeredBy)) {
              const bTime = new Date(b.finishedAt || b.startedAt).getTime()
              if (Math.abs(itemTime - bTime) <= 3600000) {
                performer = b.triggeredByName || b.triggeredBy
              }
            }
          })
        }

        return {
          id: item.id || Math.random().toString(),
          narrowSpecId: nsId,
          specId: item.specId || item.specializationId || nsInfo.specId || '',
          majorId: item.majorId || nsInfo.majorId || '',
          narrowSpecCode: code,
          narrowSpecName: name,
          version: item.version || 1,
          ns: displayName,
          note: item.note || '',
          batchCode: bCode,
          specKey: item.id || Math.random().toString(),
          twCurrent: item.twOld != null ? Math.round(Number(item.twOld)) : Math.round(Number(item.currentWeight || 0)),
          twProposed: item.twNew != null ? Math.round(Number(item.twNew)) : Math.round(Number(item.proposedWeight || 0)),
          /* Hai lỗi cũ ở ba dòng này, sửa cùng lúc:

             1. Đọc currentSacc / currentSvol / currentJunior — BA FIELD KHÔNG TỒN TẠI
                trong TrendingWeightProposalResponse. Luôn undefined, `|| 0` biến thành
                0, nên cột nào cũng hiện "0 → ...". Tên đúng là saccOld / svolOld /
                juniorRatioOld (máy chủ bắt đầu trả từ V5).
             2. Sacc và junior ratio là TỶ LỆ 0..1, không phải phần trăm. Math.round()
                thẳng nên 0.42 thành 0 — cột Junior hiện "0%" với mọi bản ghi. Phải
                nhân 100 trước, đúng như TrendingWeightPage đã làm.

             Giữ null nguyên vẹn thay vì `|| 0`: null = chưa từng có đề xuất nào được
             duyệt, khác hẳn 0 = đo được nhưng bằng không. */
          sacc: {
            cur: item.saccOld != null ? Number(item.saccOld) * 100 : null,
            new: Number(item.saccNew ?? 0) * 100
          },
          svol: {
            cur: item.svolOld != null ? Number(item.svolOld) : null,
            new: Number(item.svolNew ?? 0)
          },
          junior: {
            cur: item.juniorRatioOld != null ? Number(item.juniorRatioOld) * 100 : null,
            new: Number(item.juniorRatioNew ?? 0) * 100
          },
          jobs: item.sampleSize ?? item.totalJobsCount ?? item.jobs ?? 0,
          growthPct: item.growthRate != null ? (Number(item.growthRate) * 100).toFixed(1) : (item.growthPct || 0),
          rawDate: item.updatedAt ? new Date(item.updatedAt).getTime() : (item.createdAt ? new Date(item.createdAt).getTime() : Date.now()),
          approvedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('vi-VN') : (item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString('vi-VN') : 'Mới duyệt'),
          approvedBy: item.reviewedBy || username,
          createdBy: performer || item.reviewedBy || username
        }
      }
      const accepted = toArray(acceptedData).map(mapItem).filter(Boolean).sort((a, b) => b.rawDate - a.rawDate)
      if (aliveRef.current) {
        setHistoryList(accepted)
      }
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      if (aliveRef.current && !silent) setLoading(false)
    }
  }, [username])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Single item Rollback logic
  const handleRollback = async (item) => {
    if (!item?.narrowSpecId) {
      showToast('Lỗi: Không tìm thấy thông tin Chuyên ngành hẹp để hoàn tác')
      return
    }
    const confirmMsg = `Bạn có chắc muốn rollback trọng số của ${item.ns} về phiên bản trước?`
    if (!window.confirm(confirmMsg)) return

    try {
      const targetVer = item.version > 1 ? item.version - 1 : 1
      await rollbackTrendingWeight({ narrowSpecId: item.narrowSpecId, targetVersion: targetVer })
      showToast(`Đã rollback trọng số cho ${item.ns} thành công`, 'success')
      await loadHistory({ silent: true })
    } catch (err) {
      console.error('Failed to rollback:', err)
      showToast('Rollback thất bại: ' + (err.response?.data?.message || err.message), 'error')
    }
  }

  // Batch groups calculation
  const batchGroups = useMemo(() => getBatchGroups(historyList), [historyList])

  const activeBatchId = useMemo(() => {
    if (selectedBatchId === 'LATEST') {
      return batchGroups[0]?.id || ''
    }
    return selectedBatchId
  }, [selectedBatchId, batchGroups])

  // Batch Rollback logic
  const handleRollbackBatch = async () => {
    if (filteredHistory.length === 0) return
    const activeBatchObj = batchGroups.find(b => b.id === activeBatchId)
    const batchLabel = activeBatchObj ? activeBatchObj.dateStr : 'đang hiển thị'

    const confirmMsg = `Bạn có chắc chắn muốn rollback toàn bộ ${filteredHistory.length} trọng số trong đợt [${batchLabel}] về phiên bản trước?`
    if (!window.confirm(confirmMsg)) return

    setLoading(true)
    try {
      // Đối với Rollback Batch (Undo đợt), ta phải lùi về version - 1 
      // để trả hệ thống về trạng thái trước khi đợt này được duyệt.
      const payload = filteredHistory.map(item => ({
        narrowSpecId: item.narrowSpecId,
        targetVersion: item.version > 1 ? item.version - 1 : 1
      }))
      await rollbackTrendingWeightBatch(payload)
      showToast(`Đã rollback thành công toàn bộ ${filteredHistory.length} trọng số của đợt ${batchLabel}`, 'success')
      await loadHistory({ silent: true })
    } catch (err) {
      console.error('Failed to rollback batch:', err)
      showToast('Rollback đợt thất bại: ' + (err.response?.data?.message || err.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const availableSpecs = useMemo(() => {
    if (majorId) return specs
    const list = []
    specNameRef.current.forEach((name, id) => {
      list.push({ id, name })
    })
    return list
  }, [majorId, specs])

  const filteredHistory = useMemo(() => {
    const activeBatchObj = activeBatchId === 'ALL'
      ? null
      : batchGroups.find(b => b.id === activeBatchId)

    return historyList.filter(h => {
      if (activeBatchObj && !activeBatchObj.items.some(i => i.id === h.id)) {
        return false
      }
      if (filterAnomaly === 'ANOMALY_ONLY') {
        const isAnomaly = h.twCurrent === h.twProposed || Boolean(h.note && (h.note.includes('bình lặng') || h.note.includes('Sacc=0')))
        if (!isAnomaly) return false
      }
      if (majorId && h.majorId && h.majorId !== majorId) return false
      if (selectedSpecIds.length > 0 && h.specId && !selectedSpecIds.includes(h.specId)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchCode = (h.narrowSpecCode || '').toLowerCase().includes(q)
        const matchNs = (h.ns || '').toLowerCase().includes(q)
        const matchBatch = (h.batchCode || '').toLowerCase().includes(q)
        if (!matchCode && !matchNs && !matchBatch) return false
      }
      return true
    })
  }, [historyList, batchGroups, activeBatchId, filterAnomaly, majorId, selectedSpecIds, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize))
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredHistory.slice(start, start + pageSize)
  }, [filteredHistory, page, pageSize])

  const clearFilters = () => {
    setMajorId('')
    setSelectedSpecIds([])
    setSearchQuery('')
    setSelectedBatchId('LATEST')
    setFilterAnomaly('ALL')
    setPage(1)
  }

  const hasFilter = majorId !== '' || selectedSpecIds.length > 0 || searchQuery.trim() !== '' || filterAnomaly !== 'ALL' || (selectedBatchId !== 'LATEST' && selectedBatchId !== (batchGroups[0]?.id || ''))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Layout
      role="cm"
      user={{ name: username }}
      onLogout={handleLogout}
      onLogoClick={() => navigate('/')}
      onGoHome={() => navigate('/')}
    >
      <div className="tw-page">
        {/* ── Header ── */}
        <header className="cm-page-head" style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              className="tw-btn tw-btn--ghost tw-btn--sm"
              onClick={() => navigate('/cm/trending-weight')}
              style={{ padding: '4px 8px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={14} /> Quay lại Đề xuất trọng số
            </button>
          </div>
          <div className="cm-page-head-main">
            <span className="cm-page-head-icon"><TrendingUp size={19} strokeWidth={2.2} /></span>
            <div>
              <h1 className="cm-page-title">Lịch sử duyệt trọng số thị trường</h1>
              <p className="cm-page-sub">
                Xem lại danh sách các trọng số thị trường đã được duyệt và hoàn tác (rollback) khi cần
              </p>
            </div>
          </div>
        </header>

        {/* ── Toolbar ── */}
        <div className="tw-toolbar">
          <div className="tw-toolbar-filters">
            {/* Lọc theo đợt */}
            <div className="tw-field">
              <label className="tw-field-label" htmlFor="twh-batch">Lọc theo đợt</label>
              <select
                id="twh-batch"
                className="tw-select"
                value={selectedBatchId}
                onChange={e => {
                  setSelectedBatchId(e.target.value)
                  setPage(1)
                }}
              >
                {batchGroups.length === 0 ? (
                  <option value="LATEST">Chưa có đợt nào</option>
                ) : (
                  <>
                    {batchGroups.map((bg, index) => (
                      <option key={bg.id} value={bg.id}>
                        {index === 0 ? `Đợt gần nhất: ${bg.dateStr} (${bg.items.length} CNH)` : bg.label}
                      </option>
                    ))}
                    <option value="ALL">Tất cả các đợt ({historyList.length} CNH)</option>
                  </>
                )}
              </select>
            </div>

            {/* Filter Lỗi Anomaly / Không thay đổi */}
            <div className="tw-field">
              <label className="tw-field-label" htmlFor="twh-anomaly">Loại lịch sử</label>
              <select
                id="twh-anomaly"
                className="tw-select"
                value={filterAnomaly}
                onChange={e => {
                  setFilterAnomaly(e.target.value)
                  setPage(1)
                }}
              >
                <option value="ALL">Tất cả lịch sử</option>
                <option value="ANOMALY_ONLY">Lỗi anomaly (Không thay đổi TW)</option>
              </select>
            </div>

            {/* Ngành (Major) */}
            <div className="tw-field">
              <label className="tw-field-label" htmlFor="twh-major">Ngành (Major)</label>
              <select
                id="twh-major"
                className="tw-select"
                value={majorId}
                onChange={e => {
                  setMajorId(e.target.value)
                  setSelectedSpecIds([])
                  setPage(1)
                }}
              >
                <option value="">Tất cả ngành</option>
                {majors.map(m => (
                  <option key={m.id} value={m.id} title={m.name}>{truncate(m.name)}</option>
                ))}
              </select>
            </div>

            {/* Chuyên ngành (Đa chọn) */}
            <div className="tw-field" ref={specDropdownRef} style={{ position: 'relative' }}>
              <label className="tw-field-label">Chuyên ngành (Đa chọn)</label>
              <button
                type="button"
                className="tw-select tw-multi-select-btn"
                onClick={() => setSpecDropdownOpen(prev => !prev)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSpecIds.length === 0
                    ? 'Tất cả chuyên ngành'
                    : selectedSpecIds.length === 1
                      ? truncate(specNameRef.current.get(selectedSpecIds[0]) || '1 chuyên ngành')
                      : `Đã chọn (${selectedSpecIds.length} chuyên ngành)`}
                </span>
                <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 6, transform: specDropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
              </button>

              {specDropdownOpen && (
                <div className="tw-multi-select-dropdown">
                  <div className="tw-multi-select-header">
                    <button
                      type="button"
                      className="tw-btn-link"
                      disabled={availableSpecs.length === 0}
                      onClick={() => {
                        if (availableSpecs.length === 0) return
                        if (selectedSpecIds.length === availableSpecs.length) {
                          setSelectedSpecIds([])
                        } else {
                          setSelectedSpecIds(availableSpecs.map(s => s.id))
                        }
                        setPage(1)
                      }}
                    >
                      {availableSpecs.length > 0 && selectedSpecIds.length === availableSpecs.length
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                    {selectedSpecIds.length > 0 && (
                      <span className="tw-multi-select-count">{selectedSpecIds.length} đã chọn</span>
                    )}
                  </div>

                  <div className="tw-multi-select-list">
                    {availableSpecs.length === 0 ? (
                      <div className="tw-multi-select-empty">Không có chuyên ngành nào</div>
                    ) : (
                      availableSpecs.map(s => {
                        const isChecked = selectedSpecIds.includes(s.id)
                        return (
                          <label key={s.id} className="tw-multi-select-item">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedSpecIds(prev => prev.filter(id => id !== s.id))
                                } else {
                                  setSelectedSpecIds(prev => [...prev, s.id])
                                }
                                setPage(1)
                              }}
                            />
                            <span className="tw-multi-select-label" title={s.name}>{s.name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Nút Xóa lọc */}
            <button
              type="button"
              className="tw-btn tw-btn--ghost tw-btn--sm"
              onClick={clearFilters}
              disabled={!hasFilter}
              style={{ alignSelf: 'flex-end', height: '36px' }}
              title="Bỏ toàn bộ điều kiện lọc"
            >
              <FilterX size={14} /> Xóa lọc
            </button>
          </div>
          <div className="tw-toolbar-actions">
            {activeBatchId !== 'ALL' && filteredHistory.length > 0 && (
              <button
                type="button"
                className="tw-btn--rollback-batch"
                onClick={handleRollbackBatch}
                disabled={loading}
                style={{ alignSelf: 'flex-end', height: '36px' }}
                title="Rollback toàn bộ đợt này về phiên bản trước đó"
              >
                <Undo2 size={15} /> Rollback đợt đang xem ({filteredHistory.length} CNH)
              </button>
            )}
          </div>
        </div>

        {/* ── Table Card ── */}
        <div className="tw-card">
          <div className="tw-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
              <span className="tw-card-title">
                Lịch sử trọng số thị trường đã duyệt ({filteredHistory.length})
              </span>

              {/* Ô tìm kiếm CNH đặt cạnh tiêu đề Lịch sử */}
              <div className="tw-search-wrap" style={{ width: '260px' }}>
                <Search size={14} className="tw-search-icon" />
                <input
                  id="twh-search"
                  type="text"
                  className="tw-search-input"
                  placeholder="Tìm theo mã hoặc tên CNH..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="tw-search-clear"
                    onClick={() => {
                      setSearchQuery('')
                      setPage(1)
                    }}
                    title="Xóa tìm kiếm"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              className="tw-btn tw-btn--ghost tw-btn--sm"
              onClick={() => loadHistory()}
              disabled={loading}
              title="Nạp lại lịch sử"
              style={{ height: '32px', padding: '0 10px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={loading ? 'tw-spin' : undefined} /> Làm mới
            </button>
          </div>

          <table className="tw-table">
            <thead>
              <tr>
                <th>Narrow Specialization</th>
                <th>Trọng số TW (Cũ → Mới)</th>
                <th>Sacc</th>
                <th>Svol</th>
                <th>Junior ratio</th>
                <th>Thông tin duyệt</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="tw-empty">Đang tải lịch sử duyệt...</td>
                </tr>
              ) : paginatedHistory.length > 0 ? (
                paginatedHistory.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="tw-ns-name">{item.ns}</div>
                      {item.batchCode && <div className="tw-ns-sub">Mã phiên: {item.batchCode}</div>}
                    </td>
                    <td>
                      <span className="tw-tw-values">{item.twCurrent} → {item.twProposed}</span>
                    </td>
                    {/* "—" khi chưa từng có đề xuất nào được duyệt trước đó. Không đổi
                        thành 0: Svol 0 là "không có tin tuyển dụng nào", một kết quả đo
                        được thật, khác hẳn "không có dữ liệu để so". */}
                    <td className="tw-component">
                      <span className="tw-comp-cur">{item.sacc.cur == null ? '—' : `${item.sacc.cur.toFixed(1)}%`}</span> → {item.sacc.new.toFixed(1)}%
                    </td>
                    <td className="tw-component">
                      <span className="tw-comp-cur">{item.svol.cur == null ? '—' : Math.round(item.svol.cur)}</span> → {Math.round(item.svol.new)}
                    </td>
                    <td className="tw-component">
                      <span className="tw-comp-cur">{item.junior.cur == null ? '—' : `${item.junior.cur.toFixed(1)}%`}</span> → {item.junior.new.toFixed(1)}%
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        <div>{item.approvedAt}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {item.note && item.note.toLowerCase().includes('rolled back') ? 'Hoàn tác bởi ' : 'Duyệt bởi '}
                          <strong style={{ color: '#334155' }}>{item.approvedBy}</strong>
                        </div>
                        {item.note && (
                          <div style={{ fontSize: '11px', color: '#334155', fontStyle: 'italic', marginTop: '4px', background: '#f8fafc', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            {item.note}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="tw-cell-actions">
                      <button
                        type="button"
                        className="tw-btn-rollback"
                        onClick={() => handleRollback(item)}
                        title={`Rollback quyết định duyệt trọng số này về lại v${item.version > 1 ? item.version - 1 : 1}`}
                      >
                        <Undo2 size={12} /> Rollback
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="tw-empty">
                    {hasFilter
                      ? 'Không tìm thấy lịch sử duyệt nào phù hợp với bộ lọc.'
                      : 'Chưa có lịch sử trọng số nào được duyệt.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filteredHistory.length > 0 && (
            <CmPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredHistory.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              pageSizeOptions={[5, 10, 20, 50]}
              itemLabel="lịch sử"
            />
          )}
        </div>
      </div>

      {toast && <div className="tw-toast">{toast}</div>}
    </Layout>
  )
}
