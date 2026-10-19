import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, BookOpen, AlertTriangle, TrendingUp, Clock, FileText,
  ExternalLink, ShieldAlert, CheckCircle2, ArrowRight, Activity,
  RefreshCw, ArrowUpRight, ArrowDownRight, Tag, Heart, Ban, CalendarX,
  Check, X, Eye, LayoutDashboard
} from 'lucide-react'
import { logout } from '../../services/authService'
import Layout from '../../components/layout/Layout'
import CmPagination from '../../components/cm/CmPagination'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './CmDashboard.css'

import { getMajors, getSpecializationsByMajor } from '../../services/catalogService'
import { getCmDashboardOverview } from '../../services/dashboardService'
import { approveTrendingWeightProposal, rejectTrendingWeightProposal, getCrawlBatches } from '../../services/crawlerService'

/* ============================================================
   Hằng số
   ============================================================ */
const PAGE_SIZE = 5

/* Nhãn + tông màu cho lý do CNH thiếu dữ liệu thị trường. reasonCode do backend
   trả về, frontend chỉ ánh xạ sang cách hiển thị. */
// BV-36
const STALE_MARKET_DATA_DAYS = 30

const FALLBACK_REASONS = {
  NEVER_CRAWLED: { tone: 'red', icon: Ban, label: 'Chưa từng có dữ liệu thị trường' },
  STALE_DATA: { tone: 'orange', icon: CalendarX, label: 'Dữ liệu thị trường đã cũ' },
  FALLBACK_COEFFICIENT: { tone: 'purple', icon: AlertTriangle, label: 'Đang dùng hệ số dự phòng' },
}

/* ============================================================
   Helpers
   ============================================================ */
function toArray(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.content)) return data.content
  return []
}

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
    const performers = [...new Set(batch.items.map(i => i.createdBy || i.approvedBy || i.reviewedBy || i.performer).filter(Boolean))]
    const performerText = performers.length > 0 ? ` bởi ${performers.join(', ')}` : ''
    return {
      ...batch,
      performer: performers.join(', ') || '',
      label: `Đợt ${batch.dateStr}${performerText} (${batch.items.length} CNH)`
    }
  })
}

function paginate(list, page, size) {
  const start = (page - 1) * size
  return list.slice(start, start + size)
}

function totalPagesOf(list, size) {
  return Math.max(1, Math.ceil(list.length / size))
}

function formatWeight(value) {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(2) : '—'
}

/* ============================================================
   Sub-components
   ============================================================ */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return <CmPagination page={page} totalPages={totalPages} onPageChange={onChange} bare center className="cmd-pagination" />
}

function StatCard({ icon: Icon, label, value, tone, loading }) {
  return (
    <div className={`cmd-stat-card cmd-stat-card--${tone}`}>
      <span className="cmd-stat-rail" aria-hidden="true" />
      <div className="cmd-stat-body">
        <span className="cmd-stat-label">{label}</span>
        <span className={`cmd-stat-value${loading ? ' is-loading' : ''}`}>{loading ? '—' : value}</span>
      </div>
      <span className="cmd-stat-icon"><Icon size={18} strokeWidth={2.2} /></span>
    </div>
  )
}

/**
 * Cảnh báo ở đầu trang. `level` quyết định cả màu lẫn nhãn mức độ, để CM nhìn
 * một giây là biết cái nào phải xử lý trước.
 */
function AlertBanner({ level, icon: Icon, title, detail, action, onClick }) {
  const levelLabel = level === 'critical' ? 'Khẩn cấp' : 'Cần chú ý'
  return (
    <div className={`cmd-alert cmd-alert--${level}`}>
      <span className="cmd-alert-bar" aria-hidden="true" />
      <span className="cmd-alert-icon"><Icon size={19} strokeWidth={2.2} /></span>
      <div className="cmd-alert-body">
        <div className="cmd-alert-head">
          <span className="cmd-alert-level">{levelLabel}</span>
          <span className="cmd-alert-title">{title}</span>
        </div>
        {detail && <p className="cmd-alert-detail">{detail}</p>}
      </div>
      {action && (
        <button type="button" className="cmd-alert-cta" onClick={onClick}>
          {action} <ArrowRight size={14} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}

function CardHeader({ icon: Icon, tone, title, subtitle, count, countTone = 'neutral', children }) {
  return (
    <div className="cmd-card-head">
      <span className={`cmd-card-icon cmd-card-icon--${tone}`}><Icon size={18} strokeWidth={2.2} /></span>
      <div className="cmd-card-titles">
        <h3 className="cmd-card-title">{title}</h3>
        <p className="cmd-card-sub">{subtitle}</p>
      </div>
      <div className="cmd-card-actions">
        {count !== undefined && (
          <span className={`cmd-count cmd-count--${countTone}`}>{count}</span>
        )}
        {children}
      </div>
    </div>
  )
}

/** Trọng số trước → sau, kèm mức chênh lệch có dấu và màu theo chiều tăng/giảm. */
function WeightDelta({ before, after }) {
  // Number(null) = 0 nên Number.isFinite vẫn cho qua -> phải loại null/undefined/'' trước,
  // nếu không UI vẽ delta giả cho dữ liệu không tồn tại (DEF_48)
  const hasValue = (v) => v !== null && v !== undefined && v !== ''
  const b = Number(before)
  const a = Number(after)
  const valid = hasValue(before) && hasValue(after) && Number.isFinite(a) && Number.isFinite(b)
  const diff = valid ? a - b : 0
  const up = diff > 0
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight

  return (
    <span className="cmd-delta">
      <span className="cmd-delta-from">{formatWeight(before)}</span>
      <ArrowRight className="cmd-delta-arrow" size={13} strokeWidth={2.4} />
      <span className="cmd-delta-to">{formatWeight(after)}</span>
      {valid && (
        <span className={`cmd-delta-diff cmd-delta-diff--${up ? 'up' : 'down'}`}>
          <DeltaIcon size={12} strokeWidth={2.6} />
          {up ? '+' : '−'}{Math.abs(diff).toFixed(2)}
        </span>
      )}
    </span>
  )
}

function BlockState({ failed, tone = 'success', children }) {
  // 1 lỗi tải chung không được biến thành kết luận "mọi thứ đều ổn" ở từng khối (DEF_45)
  if (failed) {
    return <EmptyState tone="warning" icon={AlertTriangle}>Chưa đọc được dữ liệu khối này do lỗi tải. Bấm "Thử lại" ở trên.</EmptyState>
  }
  return <EmptyState tone={tone}>{children}</EmptyState>
}

function EmptyState({ tone = 'neutral', icon: Icon = CheckCircle2, children }) {
  return (
    <div className={`cmd-empty cmd-empty--${tone}`}>
      <Icon size={17} strokeWidth={2.2} />
      <span>{children}</span>
    </div>
  )
}

function SkeletonRows({ rows = 3 }) {
  return (
    <div className="cmd-skeleton">
      {Array.from({ length: rows }, (_, i) => <span key={i} className="cmd-skeleton-row" />)}
    </div>
  )
}

/* ============================================================
   Main Component
   ============================================================ */
export default function CmDashboard() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Content Manager'
  const handleLogout = async () => { await logout(); navigate('/login') }

  const { toasts, showToast, dismissToast } = useCmToast()

  const [overview, setOverview] = useState(null)
  const [crawlBatches, setCrawlBatches] = useState([])
  const [selectedTwBatchId, setSelectedTwBatchId] = useState('LATEST')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState(null)

  /* Id đề xuất đang gửi duyệt/từ chối — khoá nút để không bấm hai lần */
  const [reviewingId, setReviewingId] = useState(null)

  /* Tăng lên mỗi lần bấm "Làm mới" — đây là thứ kích hoạt effect tải lại,
     nhờ vậy effect không phải gọi setState ngay trong thân nó. */
  const [reloadToken, setReloadToken] = useState(0)

  /* Bộ lọc cho bảng Trending Weight sắp hết hạn */
  const [filterMajors, setFilterMajors] = useState([])
  const [filterSpecsByMajor, setFilterSpecsByMajor] = useState([])
  const [filterMajorId, setFilterMajorId] = useState('')
  const [filterSpecId, setFilterSpecId] = useState('')

  /* Bộ lọc cho CNH chưa gán kỹ năng / sở thích */
  const [nsGapFilter, setNsGapFilter] = useState('ALL')

  /* Trạng thái xử lý hàng loạt */
  const [batchReviewing, setBatchReviewing] = useState(false)

  /* Trang của từng danh sách */
  const [nsGapPage, setNsGapPage] = useState(1)
  const [courseGapPage, setCourseGapPage] = useState(1)
  const [twPage, setTwPage] = useState(1)
  const [twChangePage, setTwChangePage] = useState(1)
  const [fallbackPage, setFallbackPage] = useState(1)

  const reload = useCallback(() => setReloadToken(t => t + 1), [])

  useEffect(() => {
    let alive = true
    Promise.all([
      getCmDashboardOverview().catch(err => { throw err }),
      getCrawlBatches().catch(() => [])
    ])
      .then(([data, batchesData]) => {
        if (!alive) return
        setOverview(data)
        setCrawlBatches(toArray(batchesData))
        setLoadError('')
        setRefreshedAt(new Date())
      })
      .catch(err => {
        console.error('Không tải được dữ liệu dashboard:', err)
        if (alive) setLoadError('Không tải được dữ liệu dashboard. Vui lòng thử lại.')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadToken])

  /* Cờ loading phải bật lại ngay lúc bấm "Làm mới", trước khi effect chạy */
  const startReload = () => {
    setLoading(true)
    reload()
  }

  useEffect(() => {
    getMajors()
      .then(data => setFilterMajors(toArray(data).filter(m => m.isActive)))
      .catch(err => console.error('Không tải được danh sách ngành:', err))
  }, [])

  /* Cascade filter Chuyên ngành — dọn state ngay trong handler thay vì để effect
     chạy thêm một vòng render nữa. */
  const handleMajorChange = (majorId) => {
    setFilterMajorId(majorId)
    setFilterSpecId('')
    setTwPage(1)
    if (!majorId) {
      setFilterSpecsByMajor([])
      return
    }
    getSpecializationsByMajor(majorId)
      .then(data => setFilterSpecsByMajor(toArray(data).filter(s => s.isActive)))
      .catch(err => console.error(err))
  }

  const handleSpecChange = (specId) => {
    setFilterSpecId(specId)
    setTwPage(1)
  }

  /* Duyệt / từ chối ngay tại dashboard, không phải mở sang trang khác */
  const handleReview = async (item, action) => {
    const approving = action === 'approve'
    setReviewingId(item.proposalId)
    try {
      if (approving) {
        await approveTrendingWeightProposal(item.proposalId)
      } else {
        await rejectTrendingWeightProposal(item.proposalId)
      }
      showToast(
        `Đã ${approving ? 'duyệt' : 'từ chối'} đề xuất trọng số cho ${item.nsName}`,
        approving ? 'success' : 'info'
      )
      startReload()
    } catch (err) {
      console.error(err)
      showToast(
        err.response?.data?.message || `Không thể ${approving ? 'duyệt' : 'từ chối'} đề xuất này`,
        'error'
      )
    } finally {
      setReviewingId(null)
    }
  }

  const isFailed = (field) => !!loadError || (overview && overview[field] === null)

  const totals = overview?.totals
  const alerts = overview?.alerts
  const thresholds = overview?.thresholds
  // BV-36: ngưỡng dữ liệu thị trường cũ là 30 ngày kể từ mẻ crawl THÀNH CÔNG gần nhất,
  // không phải 7 ngày (DEF_04)
  const staleDays = thresholds?.staleMarketDataDays ?? STALE_MARKET_DATA_DAYS

  const nsGaps = useMemo(() => overview?.nsGaps ?? [], [overview])
  const courseGaps = useMemo(() => overview?.courseGaps ?? [], [overview])
  const twExpiring = useMemo(() => overview?.twExpiring ?? [], [overview])
  const fallbacks = useMemo(() => overview?.marketFallbacks ?? [], [overview])
  const twChanges = useMemo(() => overview?.twApproved?.changes ?? [], [overview])

  const filteredNsGaps = useMemo(() => {
    return nsGaps.filter(item => {
      if (nsGapFilter === 'SKILL') return item.missingSkill && !item.missingInterest
      if (nsGapFilter === 'INTEREST') return item.missingInterest && !item.missingSkill
      if (nsGapFilter === 'BOTH') return item.missingSkill && item.missingInterest
      return true
    })
  }, [nsGaps, nsGapFilter])

  const twChangesMapped = useMemo(() => {
    return twChanges.map(item => {
      const rawDate = item.createdAt ? new Date(item.createdAt).getTime() : (item.reviewedAt ? new Date(item.reviewedAt).getTime() : Date.now())
      let performer = null
      crawlBatches.forEach(b => {
        if (!performer && (b.finishedAt || b.startedAt) && (b.triggeredByName || b.triggeredBy)) {
          const bTime = new Date(b.finishedAt || b.startedAt).getTime()
          if (Math.abs(rawDate - bTime) <= 3600000) {
            performer = b.triggeredByName || b.triggeredBy
          }
        }
      })
      return {
        ...item,
        rawDate,
        performer: performer || item.reviewedBy || username
      }
    }).sort((a, b) => b.rawDate - a.rawDate)
  }, [twChanges, crawlBatches, username])

  const twBatchGroups = useMemo(() => getBatchGroups(twChangesMapped), [twChangesMapped])

  const activeTwBatchId = useMemo(() => {
    if (selectedTwBatchId === 'LATEST') {
      return twBatchGroups[0]?.id || ''
    }
    return selectedTwBatchId
  }, [selectedTwBatchId, twBatchGroups])

  const filteredTwChanges = useMemo(() => {
    if (activeTwBatchId === 'ALL') return twChangesMapped
    const activeBatchObj = twBatchGroups.find(b => b.id === activeTwBatchId)
    if (!activeBatchObj) return twChangesMapped
    return twChangesMapped.filter(item => activeBatchObj.items.some(i => i.proposalId === item.proposalId))
  }, [twChangesMapped, activeTwBatchId, twBatchGroups])

  const twFiltered = useMemo(() => twExpiring.filter(item => {
    if (filterMajorId && item.majorId !== filterMajorId) return false
    if (filterSpecId && item.specId !== filterSpecId) return false
    // Đề xuất còn dưới 1 ngày (1 ngày trở xuống) mới thông báo sắp hết hạn
    if (item.daysLeft != null && item.daysLeft > 1) return false
    return true
  }), [twExpiring, filterMajorId, filterSpecId])

  const handleApproveAllExpiring = async () => {
    if (twFiltered.length === 0 || batchReviewing) return
    if (!window.confirm(`Bạn có chắc chắn muốn DUYỆT TOÀN BỘ ${twFiltered.length} đề xuất trọng số sắp hết hạn?`)) return
    setBatchReviewing(true)
    let successCount = 0
    let failCount = 0
    try {
      await Promise.all(twFiltered.map(async item => {
        try {
          await approveTrendingWeightProposal(item.proposalId)
          successCount++
        } catch (e) {
          failCount++
        }
      }))
      
      if (failCount === 0) {
        showToast(`Đã duyệt thành công ${successCount} đề xuất sắp hết hạn`, 'success')
      } else if (successCount > 0) {
        showToast(`Đã duyệt thành công ${successCount}, thất bại ${failCount} đề xuất`, 'warning')
      } else {
        showToast(`Lỗi: không thể duyệt ${failCount} đề xuất`, 'error')
      }
      startReload()
    } catch (err) {
      console.error(err)
      showToast('Lỗi hệ thống khi duyệt hàng loạt đề xuất', 'error')
    } finally {
      setBatchReviewing(false)
    }
  }

  const handleRejectAllExpiring = async () => {
    if (twFiltered.length === 0 || batchReviewing) return
    if (!window.confirm(`Bạn có chắc chắn muốn TỪ CHỐI TOÀN BỘ ${twFiltered.length} đề xuất trọng số sắp hết hạn?`)) return
    setBatchReviewing(true)
    let successCount = 0
    let failCount = 0
    try {
      await Promise.all(twFiltered.map(async item => {
        try {
          await rejectTrendingWeightProposal(item.proposalId)
          successCount++
        } catch (e) {
          failCount++
        }
      }))
      
      if (failCount === 0) {
        showToast(`Đã từ chối thành công ${successCount} đề xuất sắp hết hạn`, 'info')
      } else if (successCount > 0) {
        showToast(`Đã từ chối ${successCount}, thất bại ${failCount} đề xuất`, 'warning')
      } else {
        showToast(`Lỗi: không thể từ chối ${failCount} đề xuất`, 'error')
      }
      startReload()
    } catch (err) {
      console.error(err)
      showToast('Lỗi hệ thống khi từ chối hàng loạt đề xuất', 'error')
    } finally {
      setBatchReviewing(false)
    }
  }

  const nsGapPageItems = paginate(filteredNsGaps, nsGapPage, PAGE_SIZE)
  const courseGapPageItems = paginate(courseGaps, courseGapPage, PAGE_SIZE)
  const twPageItems = paginate(twFiltered, twPage, PAGE_SIZE)
  const twChangePageItems = paginate(filteredTwChanges, twChangePage, PAGE_SIZE)
  const fallbackPageItems = paginate(fallbacks, fallbackPage, PAGE_SIZE)

  const majorOptions = useMemo(
    () => [{ value: '', label: 'Tất cả ngành' }, ...filterMajors.map(m => ({ value: m.id, label: m.name }))],
    [filterMajors]
  )
  const specOptions = useMemo(
    () => [{ value: '', label: 'Tất cả chuyên ngành' }, ...filterSpecsByMajor.map(s => ({ value: s.id, label: s.name }))],
    [filterSpecsByMajor]
  )

  const hasAlerts = (alerts?.pendingContentErrors > 0) || (alerts?.runningCrawlBatches > 0)

  return (
    <Layout
      role="cm"
      user={{ name: username }}
      onLogout={handleLogout}
      onLogoClick={() => navigate('/')}
      onGoHome={() => navigate('/')}
    >
      <div className="cmd-page">

        {/* ── HEADER ───────────────────────────────────── */}
        <header className="cmd-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cm-page-head-icon"><LayoutDashboard size={20} strokeWidth={2.2} /></span>
            <div>
              <h1 className="cmd-header-title">Content Management Dashboard</h1>
              <p className="cmd-header-sub">
                Tổng quan nội dung chương trình học thuật &amp; trọng số thị trường SMOSP
              </p>
            </div>
          </div>
          <div className="cmd-header-right">
            {refreshedAt && (
              <span className="cmd-refresh-time">
                Cập nhật {refreshedAt.toLocaleTimeString('vi-VN')}
              </span>
            )}
            <button type="button" className="cmd-btn-ghost" onClick={startReload} disabled={loading}>
              <RefreshCw size={14} strokeWidth={2.4} className={loading ? 'cmd-spin' : ''} />
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </header>

        {loadError && (
          <AlertBanner
            level="critical"
            icon={AlertTriangle}
            title={loadError}
            action="Thử lại"
            onClick={startReload}
          />
        )}

        {/* ── CẢNH BÁO ─────────────────────────────────── */}
        {hasAlerts && (
          <div className="cmd-alert-stack">
            {alerts.pendingContentErrors > 0 && (
              <AlertBanner
                level="critical"
                icon={ShieldAlert}
                title={`${alerts.pendingContentErrors} báo cáo lỗi nội dung chưa xử lý`}
                detail="Sinh viên đang thấy nội dung bị báo sai. Xử lý sớm để tránh ảnh hưởng lộ trình học."
                action="Xử lý ngay"
                onClick={() => navigate('/cm/error-reports')}
              />
            )}
            {alerts.runningCrawlBatches > 0 && (
              <AlertBanner
                level="warning"
                icon={Activity}
                title={`${alerts.runningCrawlBatches} đợt thu thập dữ liệu chưa hoàn tất`}
                detail="Trọng số thị trường chỉ được tính lại sau khi đợt thu thập kết thúc."
                action="Xem chi tiết"
                onClick={() => navigate('/cm/trending-weight')}
              />
            )}
          </div>
        )}

        {/* ── SECTION 1: NỘI DUNG HỌC THUẬT ───────────── */}
        <section className="cmd-zone">
          <div className="cmd-sec-title">
            <Layers size={15} strokeWidth={2.4} />
            <span>Nội dung học thuật</span>
          </div>

          <div className="cmd-stat-grid">
            <StatCard label="Tổng số môn học" value={isFailed('totals') ? 'Lỗi' : totals?.courses} icon={BookOpen} tone="blue" loading={loading} />
            <StatCard label="Khối ngành học" value={isFailed('totals') ? 'Lỗi' : totals?.majors} icon={Layers} tone="purple" loading={loading} />
            <StatCard label="Chuyên ngành" value={isFailed('totals') ? 'Lỗi' : totals?.specializations} icon={FileText} tone="teal" loading={loading} />
            <StatCard label="Chuyên ngành hẹp" value={isFailed('totals') ? 'Lỗi' : totals?.narrowSpecs} icon={TrendingUp} tone="orange" loading={loading} />
          </div>

          <div className="cmd-row-2">
            {/* CNH chưa gán Kỹ năng / Sở thích */}
            <div className="cmd-card">
              <CardHeader
                icon={Layers}
                tone="purple"
                title="CNH chưa gán Kỹ năng / Sở thích"
                subtitle="Cần bổ sung ma trận Kỹ năng hoặc Sở thích trong Tag Map"
                count={loading ? '—' : filteredNsGaps.length}
                countTone={filteredNsGaps.length > 0 ? 'warning' : 'success'}
              >
                {nsGaps.length > 0 && (
                  <select
                    className="tw-select"
                    value={nsGapFilter}
                    onChange={e => {
                      setNsGapFilter(e.target.value)
                      setNsGapPage(1)
                    }}
                    style={{ padding: '4px 8px', fontSize: '12.5px', height: '30px' }}
                  >
                    <option value="ALL">Tất cả ({nsGaps.length})</option>
                    <option value="SKILL">Thiếu kỹ năng</option>
                    <option value="INTEREST">Thiếu sở thích</option>
                    <option value="BOTH">Thiếu cả hai</option>
                  </select>
                )}
              </CardHeader>

              {loading ? (
                <SkeletonRows />
              ) : isFailed('nsGaps') ? (
                <BlockState failed={true}>Chưa đọc được dữ liệu khối này do lỗi tải</BlockState>
              ) : nsGaps.length === 0 ? (
                <BlockState>Tất cả CNH đã được gán đầy đủ kỹ năng &amp; sở thích</BlockState>
              ) : filteredNsGaps.length === 0 ? (
                <BlockState>Không có CNH nào phù hợp với bộ lọc</BlockState>
              ) : (
                <>
                  <div className="cmd-list">
                    {nsGapPageItems.map(item => (
                      <button
                        type="button"
                        key={item.nsId}
                        className="cmd-list-row"
                        onClick={() => navigate('/cm/tagmap', { state: { majorId: item.majorId, specId: item.specId, nsId: item.nsId } })}
                        title="Bấm để đến trang Tag Map của CNH này"
                      >
                        <span className="cmd-list-main">
                          <span className="cmd-list-name">{item.nsName}</span>
                          {item.specName && <span className="cmd-list-sub">{item.specName}</span>}
                        </span>
                        <span className="cmd-tags">
                          {item.missingSkill && (
                            <span className="cm-tag cm-tag--orange"><Tag size={11} strokeWidth={2.4} /> Thiếu kỹ năng</span>
                          )}
                          {item.missingInterest && (
                            <span className="cm-tag cm-tag--purple"><Heart size={11} strokeWidth={2.4} /> Thiếu sở thích</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <Pagination page={nsGapPage} totalPages={totalPagesOf(filteredNsGaps, PAGE_SIZE)} onChange={setNsGapPage} />
                </>
              )}
            </div>

            {/* Môn học chưa gán Kỹ năng */}
            <div className="cmd-card">
              <CardHeader
                icon={BookOpen}
                tone="orange"
                title="Môn học chưa gán Kỹ năng"
                subtitle="Môn học trong chương trình chưa có kỹ năng rèn luyện nào"
                count={loading ? '—' : courseGaps.length}
                countTone={courseGaps.length > 0 ? 'warning' : 'success'}
              />

              {loading ? (
                <SkeletonRows />
              ) : isFailed('courseGaps') ? (
                <BlockState failed={true}>Chưa đọc được dữ liệu khối này do lỗi tải</BlockState>
              ) : courseGaps.length === 0 ? (
                <BlockState>Tất cả môn học đều đã được gán kỹ năng</BlockState>
              ) : (
                <>
                  <div className="cmd-list">
                    {courseGapPageItems.map(item => (
                      <button
                        type="button"
                        key={item.id}
                        className="cmd-list-row"
                        onClick={() => navigate('/cm/courses', { state: { selectedId: item.id, search: item.code || item.name } })}
                        title="Bấm để xem chi tiết môn học này"
                      >
                        <span className="cmd-list-main">
                          <span className="cmd-list-name">
                            {item.code && <span className="cm-tag cm-tag--blue cmd-code-tag">{item.code}</span>}
                            {item.name}
                          </span>
                        </span>
                        <span className="cmd-row-cta">Chi tiết <ExternalLink size={12} strokeWidth={2.4} /></span>
                      </button>
                    ))}
                  </div>
                  <Pagination page={courseGapPage} totalPages={totalPagesOf(courseGaps, PAGE_SIZE)} onChange={setCourseGapPage} />
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION 2: THỊ TRƯỜNG & TRENDING WEIGHT ──── */}
        <section className="cmd-zone">
          <div className="cmd-sec-title">
            <TrendingUp size={15} strokeWidth={2.4} />
            <span>Thị trường &amp; trọng số thị trường</span>
          </div>

          {/* Sắp hết hạn duyệt */}
          <div className="cmd-card">
            <CardHeader
              icon={Clock}
              tone="danger"
              title="Đề xuất trọng số sắp hết hạn duyệt"
              subtitle="Đề xuất còn từ 1 ngày trở xuống trước khi tự động bị từ chối"
              count={loading ? '—' : twFiltered.length}
              countTone={twFiltered.length > 0 ? 'danger' : 'success'}
            >
              <button
                type="button"
                className="cmd-btn-primary"
                onClick={() => navigate('/cm/trending-weight')}
                title="Mở trang danh sách đề xuất trọng số thị trường"
              >
                Xem toàn bộ đề xuất <ArrowRight size={14} strokeWidth={2.4} />
              </button>
            </CardHeader>

            {loading ? (
              <SkeletonRows rows={4} />
            ) : (
              <>
                <div className="cmd-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <CmSelect
                      options={majorOptions}
                      value={filterMajorId}
                      onChange={handleMajorChange}
                      placeholder="Tất cả ngành"
                      size="sm"
                      highlightActive
                      width="200px"
                    />
                    <CmSelect
                      options={specOptions}
                      value={filterSpecId}
                      onChange={handleSpecChange}
                      placeholder="Tất cả chuyên ngành"
                      size="sm"
                      highlightActive
                      disabled={!filterMajorId}
                      width="220px"
                    />
                  </div>
                  {twFiltered.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="cm-btn cm-btn--success cm-btn--sm"
                        onClick={handleApproveAllExpiring}
                        disabled={batchReviewing}
                        title="Duyệt tất cả đề xuất sắp hết hạn cùng một lúc"
                      >
                        <Check size={13} strokeWidth={2.6} /> Duyệt tất cả ({twFiltered.length})
                      </button>
                      <button
                        type="button"
                        className="cm-btn cm-btn--danger cm-btn--sm"
                        onClick={handleRejectAllExpiring}
                        disabled={batchReviewing}
                        title="Từ chối tất cả đề xuất sắp hết hạn cùng một lúc"
                      >
                        <X size={13} strokeWidth={2.6} /> Từ chối tất cả ({twFiltered.length})
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <SkeletonRows />
                ) : isFailed('twExpiring') ? (
                  <BlockState failed={true}>Chưa đọc được dữ liệu khối này do lỗi tải</BlockState>
                ) : twFiltered.length === 0 ? (
                  <BlockState>Không có đề xuất trọng số nào sắp hết hạn duyệt</BlockState>
                ) : (
                  <>
                    <div className="cmd-table-wrap">
                      <table className="cmd-table">
                        <thead>
                          <tr>
                            <th>Chuyên ngành hẹp</th>
                            <th>Trọng số hiện tại → đề xuất</th>
                            <th>Hạn duyệt</th>
                            <th className="cmd-th-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {twPageItems.map(item => (
                            <tr key={item.proposalId}>
                              <td>
                                <span className="cmd-list-name">{item.nsName}</span>
                                {item.specName && <span className="cmd-list-sub">{item.specName}</span>}
                              </td>
                              <td><WeightDelta before={item.currentValue} after={item.proposedValue} /></td>
                              <td>
                                <span className={`cm-tag ${item.daysLeft <= 1 ? 'cm-tag--red' : 'cm-tag--orange'}`}>
                                  <Clock size={11} strokeWidth={2.4} />
                                  {item.daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${item.daysLeft} ngày`}
                                </span>
                              </td>
                              <td className="cmd-td-right">
                                <div className="cmd-row-actions">
                                  <button
                                    type="button"
                                    className="cm-btn cm-btn--success cm-btn--sm"
                                    onClick={() => handleReview(item, 'approve')}
                                    disabled={reviewingId === item.proposalId}
                                    title={`Duyệt đề xuất cho ${item.nsName}`}
                                  >
                                    <Check size={13} strokeWidth={2.6} /> Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    className="cm-btn cm-btn--danger cm-btn--sm"
                                    onClick={() => handleReview(item, 'reject')}
                                    disabled={reviewingId === item.proposalId}
                                    title={`Từ chối đề xuất cho ${item.nsName}`}
                                  >
                                    <X size={13} strokeWidth={2.6} /> Từ chối
                                  </button>
                                  <button
                                    type="button"
                                    className="cm-btn-icon"
                                    onClick={() => navigate(`/cm/trending-weight/${item.nsId}`)}
                                    title="Xem chi tiết đề xuất"
                                  >
                                    <Eye size={14} strokeWidth={2.3} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={twPage} totalPages={totalPagesOf(twFiltered, PAGE_SIZE)} onChange={setTwPage} />
                  </>
                )}
              </>
            )}
          </div>

          {/* Thay đổi trọng số đã duyệt */}
          <div className="cmd-card">
            <CardHeader
              icon={TrendingUp}
              tone="blue"
              title="Thay đổi trọng số thị trường đã duyệt"
              subtitle={`${overview?.twApproved?.approvedCount ?? 0} đề xuất đã duyệt, trong đó ${overview?.twApproved?.changedCount ?? 0} làm đổi trọng số thực tế`}
              count={loading ? '—' : filteredTwChanges.length}
              countTone="info"
            >
              {twChangesMapped.length > 0 && (
                <select
                  className="tw-select"
                  value={selectedTwBatchId}
                  onChange={e => {
                    setSelectedTwBatchId(e.target.value)
                    setTwChangePage(1)
                  }}
                  style={{ padding: '4px 8px', fontSize: '12.5px', height: '30px', maxWidth: '320px' }}
                >
                  {twBatchGroups.length === 0 ? (
                    <option value="LATEST">Chưa có đợt nào</option>
                  ) : (
                    <>
                      {twBatchGroups.map((bg, index) => (
                        <option key={bg.id} value={bg.id}>
                          {index === 0 ? `Đợt gần nhất: ${bg.dateStr} (${bg.items.length} CNH)` : bg.label}
                        </option>
                      ))}
                      <option value="ALL">Tất cả các đợt ({twChangesMapped.length} CNH)</option>
                    </>
                  )}
                </select>
              )}
            </CardHeader>

            {loading ? (
              <SkeletonRows />
            ) : isFailed('twApproved') ? (
              <BlockState failed={true}>Chưa đọc được dữ liệu khối này do lỗi tải</BlockState>
            ) : twChangesMapped.length === 0 ? (
              <EmptyState>Chưa có đề xuất nào được duyệt làm thay đổi trọng số</EmptyState>
            ) : filteredTwChanges.length === 0 ? (
              <EmptyState>Không tìm thấy thay đổi nào phù hợp với đợt đã chọn</EmptyState>
            ) : (
              <>
                <div className="cmd-list">
                  {twChangePageItems.map(item => (
                    <div key={item.proposalId} className="cmd-list-row is-static">
                      <span className="cmd-list-main">
                        <span className="cmd-list-name">{item.nsName}</span>
                        <span className="cmd-list-sub">
                          {item.reviewedAt && `Duyệt ngày ${new Date(item.reviewedAt).toLocaleDateString('vi-VN')}`}
                          {item.performer && ` • Thực hiện bởi ${item.performer}`}
                        </span>
                      </span>
                      <WeightDelta before={item.before} after={item.after} />
                    </div>
                  ))}
                </div>
                <Pagination page={twChangePage} totalPages={totalPagesOf(filteredTwChanges, PAGE_SIZE)} onChange={setTwChangePage} />
              </>
            )}
          </div>

          {/* CNH thiếu dữ liệu thị trường */}
          <div className="cmd-card">
            <CardHeader
              icon={AlertTriangle}
              tone="warning"
              title="CNH dùng hệ số dự phòng / thiếu dữ liệu thị trường"
              subtitle={`Chưa đủ dữ liệu tuyển dụng tin cậy, hoặc không có dữ liệu thu thập mới từ ${staleDays} ngày trở lên`}
              count={loading ? '—' : fallbacks.length}
              countTone={fallbacks.length > 0 ? 'warning' : 'success'}
            />

            {loading ? (
              <SkeletonRows rows={4} />
            ) : isFailed('marketFallbacks') ? (
              <BlockState failed={true}>Chưa đọc được dữ liệu khối này do lỗi tải</BlockState>
            ) : fallbacks.length === 0 ? (
              <EmptyState tone="success">
                Tất cả CNH đều có dữ liệu thị trường cập nhật trong {staleDays} ngày qua
              </EmptyState>
            ) : (
              <>
                <div className="cmd-list">
                  {fallbackPageItems.map(item => {
                    const reason = FALLBACK_REASONS[item.reasonCode] || FALLBACK_REASONS.STALE_DATA
                    const ReasonIcon = reason.icon
                    const label = item.reasonCode === 'STALE_DATA' && item.daysSinceLastData != null
                      ? `Không có dữ liệu mới ${item.daysSinceLastData} ngày`
                      : reason.label
                    return (
                      <div key={item.nsId} className="cmd-list-row is-static">
                        <span className="cmd-list-main">
                          <span className="cmd-list-name">{item.nsName}</span>
                          {item.specName && <span className="cmd-list-sub">{item.specName}</span>}
                        </span>
                        <span className={`cm-tag cm-tag--${reason.tone}`}>
                          <ReasonIcon size={11} strokeWidth={2.4} /> {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Pagination page={fallbackPage} totalPages={totalPagesOf(fallbacks, PAGE_SIZE)} onChange={setFallbackPage} />
              </>
            )}
          </div>
        </section>

      </div>

      <CmToast toasts={toasts} onDismiss={dismissToast} />
    </Layout>
  )
}
