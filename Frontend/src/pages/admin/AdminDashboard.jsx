import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, GraduationCap, UserCog, UserX, Layers, Network, BookOpen,
  Cpu, FileText, TrendingUp, Database, RefreshCw, ArrowRight, LayoutDashboard,
  CalendarClock, CheckCircle2, XCircle, Download, Filter, PlayCircle, Settings2
} from 'lucide-react'
import { logout } from '../../services/authService'
import { getSystemStats, getAiUsageStats, getSystemConfigs } from '../../services/systemService'
import { getCrawlBatches } from '../../services/crawlerService'
import { getTranscriptPresets } from '../../services/transcriptPresetService'
import Layout from '../../components/layout/Layout'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './AdminDashboard.css'

/* ============================================================
   Hằng số
   ============================================================ */
// DataSeeder đặt `ai_monthly_token_quota` = 1.000.000. Hằng số cũ 5.000.000 khiến
// ngưỡng cảnh báo 80% chỉ bắn khi đã dùng 400% hạn mức thật (DEF_03, gap BV-41).
// Chỉ dùng khi backend không trả `quotaTokens`; khi đó UI phải nói rõ là ước lượng.
const FALLBACK_TOKEN_QUOTA = 1_000_000

/* Nhãn tiếng Việt cho các trường ánh xạ bảng điểm — backend lưu khoá kỹ thuật */
const PRESET_FIELD_LABELS = {
  no: 'STT',
  term: 'Kỳ',
  semester: 'Học kỳ',
  subject_code: 'Mã môn học',
  subjectCode: 'Mã môn học',
  courseCode: 'Mã môn học',
  subject_name: 'Tên môn học',
  courseName: 'Tên môn học',
  credit: 'Số tín chỉ',
  credits: 'Số tín chỉ',
  grade: 'Điểm số',
  score: 'Điểm số',
  status: 'Trạng thái',
}

/* ============================================================
   Helpers
   ============================================================ */
function toArray(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.content)) return data.content
  return []
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('vi-VN')
}

function percentOf(used, total) {
  if (!total) return 0
  return Math.round((used / total) * 100)
}

/* Rút gọn số token cho trục biểu đồ: 1.250.000 → 1,25 Tr */
function compactTokens(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Tr`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

/* Màu theo mức tiêu thụ so với hạn mức — cùng thang với phần còn lại của trang */
function tokenTone(pct) {
  if (pct >= 100) return { color: '#d93025', tone: 'danger' }
  if (pct >= 80) return { color: '#F37021', tone: 'warn' }
  return { color: '#034EA2', tone: 'normal' }
}

/* ============================================================
   Sub-components
   ============================================================ */
function StatCard({ icon: Icon, label, value, hint, tone, loading, onClick, title, failed }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`ad-stat-card ad-stat-card--${tone}${onClick ? ' is-link' : ''}`}
      {...(onClick ? { type: 'button', onClick, title } : {})}
    >
      <span className="ad-stat-rail" aria-hidden="true" />
      <span className="ad-stat-body">
        <span className="ad-stat-label">{label}</span>
        <span className={`ad-stat-value${loading ? ' is-loading' : ''}`}>
          {/* Lỗi tải mà vẫn render 0 thì Admin đọc như số liệu thật (DEF_178) */}
          {loading ? '—' : failed ? '—' : formatNumber(value)}
        </span>
        {!loading && failed
          ? <span className="ad-stat-hint">Chưa đọc được số liệu</span>
          : (hint && !loading && <span className="ad-stat-hint">{hint}</span>)}
      </span>
      <span className="ad-stat-icon"><Icon size={18} strokeWidth={2.2} /></span>
    </Tag>
  )
}

function CardHead({ icon: Icon, tone, title, subtitle, children }) {
  return (
    <div className="ad-card-head">
      <span className={`ad-card-icon ad-card-icon--${tone}`}><Icon size={18} strokeWidth={2.2} /></span>
      <div className="ad-card-titles">
        <h3 className="ad-card-title">{title}</h3>
        {subtitle && <p className="ad-card-sub">{subtitle}</p>}
      </div>
      {children && <div className="ad-card-actions">{children}</div>}
    </div>
  )
}

function SkeletonRows({ rows = 4, chart = false }) {
  return (
    <div className="ad-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={`ad-skeleton-row${chart ? ' ad-skeleton-row--chart' : ''}`} />
      ))}
    </div>
  )
}

/**
 * Mức tiêu thụ token AI của 4 tháng gần nhất.
 *
 * Trục dọc khoá cứng ở đúng hạn mức tháng, nên chiều cao cột đọc được ngay là
 * "đã dùng bao nhiêu phần hạn mức" mà không cần đọc số. Cột đổi màu khi vượt
 * 80% và 100% hạn mức.
 */
function TokenMonthlyChart({ months, quota }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || typeof window.Chart !== 'function') return
    let chart
    try {
      chart = new window.Chart(ref.current, {
        type: 'bar',
        data: {
          labels: months.map(m => m.label),
          datasets: [{
            label: 'Token đã dùng',
            data: months.map(m => m.tokens),
            backgroundColor: months.map(m => tokenTone(percentOf(m.tokens, quota)).color),
            borderRadius: 6,
            maxBarThickness: 54,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            y: {
              beginAtZero: true,
              max: quota,
              ticks: {
                callback: (value) => compactTokens(value),
                font: { family: 'Be Vietnam Pro', size: 11 },
                color: '#6b7280',
              },
              grid: { color: '#f0f0f0' },
            },
            x: {
              ticks: { font: { family: 'Be Vietnam Pro', size: 11, weight: '600' }, color: '#6b7280' },
              grid: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const used = ctx.raw || 0
                  return ` ${formatNumber(used)} / ${formatNumber(quota)} token (${percentOf(used, quota)}% hạn mức)`
                },
              },
            },
          },
        },
      })
    } catch (err) {
      console.error('Không vẽ được biểu đồ token AI:', err)
    }
    return () => chart && chart.destroy()
  }, [months, quota])

  return (
    <div className="ad-chart-wrap">
      <canvas ref={ref} role="img" aria-label="Mức tiêu thụ token AI theo 4 tháng gần nhất" />
    </div>
  )
}

/** Tỷ lệ đề xuất trọng số theo trạng thái duyệt. */
function ProposalDonut({ approved, pending, rejected, total }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || typeof window.Chart !== 'function') return
    const hasData = total > 0
    let chart
    try {
      chart = new window.Chart(ref.current, {
        type: 'doughnut',
        data: {
          labels: hasData ? ['Đã duyệt', 'Chờ duyệt', 'Từ chối'] : ['Chưa có đề xuất'],
          datasets: [{
            data: hasData ? [approved, pending, rejected] : [1],
            backgroundColor: hasData ? ['#51B848', '#F37021', '#d93025'] : ['#e9edf5'],
            borderWidth: 2,
            borderColor: '#fff',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: hasData,
              callbacks: { label: (c) => ` ${c.label}: ${formatNumber(c.raw)} đề xuất` },
            },
          },
        },
      })
    } catch (err) {
      console.error('Không vẽ được biểu đồ đề xuất trọng số:', err)
    }
    return () => chart && chart.destroy()
  }, [approved, pending, rejected, total])

  return (
    <div className="ad-donut-wrap">
      <canvas ref={ref} role="img" aria-label="Tỷ lệ đề xuất trọng số theo trạng thái duyệt" />
    </div>
  )
}

/* ============================================================
   Main Component
   ============================================================ */
export default function AdminDashboard() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Admin'
  const handleLogout = async () => { await logout(); navigate('/login') }

  const { toasts, showToast, dismissToast } = useCmToast()

  const [stats, setStats] = useState(null)
  const [aiUsage, setAiUsage] = useState(null)
  const [latestBatch, setLatestBatch] = useState(null)
  const [aiConfig, setAiConfig] = useState({ provider: 'Gemini', model: 'gemini-1.5-flash' })
  const [activePreset, setActivePreset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const [statsFailed, setStatsFailed] = useState(false)
  const [configsFailed, setConfigsFailed] = useState(false)
  const [batchesFailed, setBatchesFailed] = useState(false)

  /* Tăng lên mỗi lần bấm "Làm mới" — đây là thứ kích hoạt effect tải lại */
  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken(t => t + 1), [])

  useEffect(() => {
    let alive = true

    Promise.all([
      getSystemStats().catch(err => { console.error('Không tải được số liệu hệ thống:', err); return null }),
      getAiUsageStats().catch(err => { console.error('Không tải được số liệu token AI:', err); return null }),
      getSystemConfigs().catch(err => { console.error('Không tải được cấu hình hệ thống:', err); return null }),
      getTranscriptPresets().catch(err => { console.error('Không tải được preset bảng điểm:', err); return null }),
      getCrawlBatches().catch(err => { console.error('Không tải được đợt thu thập dữ liệu:', err); return null }),
    ]).then(([sysStats, ai, configs, presets, batches]) => {
      if (!alive) return

      // Nuốt lỗi thành null rồi render 0 khiến Admin đọc "0" như số liệu thật (DEF_178/179/182)
      setStatsFailed(sysStats === null)
      setConfigsFailed(configs === null)
      setBatchesFailed(batches === null)

      setStats(sysStats)
      setAiUsage(ai)

      /* Đợt thu thập gần nhất — ưu tiên bản ghi batch, thiếu thì lấy tóm tắt
         trong system-status để thẻ không bị rỗng */
      const batchList = toArray(batches)
      const raw = batchList[0]
      if (raw) {
        setLatestBatch({
          status: raw.status || sysStats?.lastCrawlBatchStatus || 'SUCCESS',
          finishedAt: formatDateTime(raw.finishedAt) || formatDateTime(sysStats?.lastCrawlFinishedAt),
          startedAt: formatDateTime(raw.startedAt),
          totalFetched: raw.totalFetched ?? 0,
          totalParsed: raw.totalParsed ?? 0,
          totalErrors: raw.totalErrors ?? 0,
          triggeredBy: raw.triggeredBy || 'Hệ thống (theo lịch)',
        })
      } else if (batches !== null && sysStats?.lastCrawlBatchStatus) {
        // Chỉ dựng tóm tắt rút gọn khi việc tải batch THÀNH CÔNG mà danh sách rỗng.
        // Nếu tải lỗi thì 0/0/0 là số bịa, không được hiện (DEF_182).
        setLatestBatch({
          status: sysStats.lastCrawlBatchStatus,
          finishedAt: formatDateTime(sysStats.lastCrawlFinishedAt),
          totalFetched: null,
          totalParsed: null,
          totalErrors: null,
          triggeredBy: 'Hệ thống (theo lịch)',
        })
      } else {
        setLatestBatch(null)
      }

      if (Array.isArray(configs)) {
        const map = Object.fromEntries(configs.map(c => [c.configKey, c.configValue]))
        setAiConfig({
          provider: map.ai_provider || null,
          model: map.ai_model || null,
        })
      } else {
        // Trước đây bỏ qua nhánh này nên giá trị mặc định cứng 'Gemini'/'gemini-1.5-flash'
        // đứng nguyên trên màn như thể đọc được từ hệ thống (DEF_179)
        setAiConfig({ provider: null, model: null })
      }

      const presetList = toArray(presets)
      // Không được rơi về presetList[0]: preset không-active hiện lên như đang dùng (DEF_180)
      const active = presetList.find(p => p.isActive) || null
      setActivePreset(active ? {
        name: active.presetName || 'Preset mặc định',
        isActive: Boolean(active.isActive),
        updatedAt: active.updatedAt ? new Date(active.updatedAt).toLocaleDateString('vi-VN') : null,
        fields: Object.entries(active.columnMapping || {})
          .filter(([, column]) => column)
          .map(([key, column]) => ({ label: PRESET_FIELD_LABELS[key] || key, column: String(column) })),
      } : null)

      setRefreshedAt(new Date())
      if (!sysStats) showToast('Một số số liệu hệ thống chưa tải được, vui lòng thử lại', 'warning')
    }).finally(() => {
      if (alive) setLoading(false)
    })

    return () => { alive = false }
  }, [reloadToken, showToast])

  /* Cờ loading phải bật lại ngay lúc bấm "Làm mới", trước khi effect chạy */
  const startReload = () => {
    setLoading(true)
    reload()
  }

  /* ── Số liệu dẫn xuất ── */
  const usersByRole = stats?.usersByRole || {}
  const usersByStatus = stats?.usersByStatus || {}

  const totalAccounts = useMemo(
    () => Object.values(stats?.usersByRole || {}).reduce((sum, n) => sum + Number(n || 0), 0),
    [stats]
  )
  const totalStudents = stats?.totalStudents ?? (usersByRole.ROLE_STUDENT || usersByRole.STUDENT || 0)
  const totalCms = usersByRole.ROLE_CONTENT_MANAGER || usersByRole.CONTENT_MANAGER || 0
  const totalAdmins = usersByRole.ROLE_ADMIN || usersByRole.ADMIN || 0
  const inactiveAccounts = usersByStatus.INACTIVE || 0
  const activeAccounts = usersByStatus.ACTIVE || 0

  const hasRealQuota = Number(aiUsage?.quotaTokens) > 0
  const tokenQuota = hasRealQuota ? Number(aiUsage.quotaTokens) : FALLBACK_TOKEN_QUOTA
  const monthlyTokens = useMemo(() => {
    const list = Array.isArray(aiUsage?.monthlyUsage) ? aiUsage.monthlyUsage : []
    return list.map(m => ({ label: m.label, tokens: Number(m.tokens || 0) }))
  }, [aiUsage])

  const tokensThisMonth = aiUsage?.totalTokens ?? stats?.aiTokensThisMonth ?? 0
  const tokenPct = percentOf(tokensThisMonth, tokenQuota)
  const { color: tokenColor, tone: tokenToneName } = tokenTone(tokenPct)
  const peakMonth = useMemo(
    () => monthlyTokens.reduce((max, m) => (m.tokens > (max?.tokens ?? -1) ? m : max), null),
    [monthlyTokens]
  )

  const approvedTw = stats?.approvedTwProposals ?? 0
  const pendingTw = stats?.pendingTwProposals ?? 0
  const rejectedTw = stats?.rejectedTwProposals ?? 0
  const totalTw = stats?.totalTwProposals ?? (approvedTw + pendingTw + rejectedTw)

  // PARTIAL_SUCCESS / RUNNING / CANCELLED không phải "Thành công" (DEF_181)
  const BATCH_TAG = {
    SUCCESS: { cls: 'cm-tag--green', label: 'Thành công' },
    COMPLETED: { cls: 'cm-tag--green', label: 'Thành công' },
    PARTIAL_SUCCESS: { cls: 'cm-tag--orange', label: 'Thành công một phần' },
    RUNNING: { cls: 'cm-tag--blue', label: 'Đang chạy' },
    PENDING: { cls: 'cm-tag--blue', label: 'Đang chờ' },
    FAILED: { cls: 'cm-tag--red', label: 'Thất bại' },
    CANCELLED: { cls: 'cm-tag--gray', label: 'Đã huỷ' },
  }
  const batchFailed = latestBatch?.status === 'FAILED'
  const batchTag = BATCH_TAG[latestBatch?.status] || { cls: 'cm-tag--gray', label: latestBatch?.status || 'Không rõ' }

  return (
    <Layout
      role="admin"
      user={{ name: username }}
      onLogout={handleLogout}
      onLogoClick={() => navigate('/')}
      onGoHome={() => navigate('/')}
    >
      <div className="ad-page">

        {/* ── ĐẦU TRANG ───────────────────────────────── */}
        <header className="ad-header">
          <div className="ad-header-main">
            <span className="ad-header-icon"><LayoutDashboard size={20} strokeWidth={2.2} /></span>
            <div>
              <h1 className="ad-header-title">Bảng điều khiển quản trị</h1>
              <p className="ad-header-sub">
                Tổng quan tài khoản người dùng, danh mục nội dung, thu thập dữ liệu thị trường và mức tiêu thụ token AI
              </p>
            </div>
          </div>
          <div className="ad-header-right">
            {refreshedAt && (
              <span className="ad-refresh-time">Cập nhật {refreshedAt.toLocaleTimeString('vi-VN')}</span>
            )}
            <button type="button" className="cm-btn cm-btn--secondary" onClick={startReload} disabled={loading}>
              <RefreshCw size={14} strokeWidth={2.4} className={loading ? 'ad-spin' : ''} />
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </header>

        {/* ── KHU 1: TÀI KHOẢN NGƯỜI DÙNG ─────────────── */}
        <section className="ad-zone">
          <div className="ad-sec-title">
            <Users size={15} strokeWidth={2.4} />
            <span>Tài khoản người dùng</span>
          </div>

          <div className="ad-stat-grid">
            <StatCard
              label="Tổng tài khoản"
              value={totalAccounts}
              hint={`${formatNumber(activeAccounts)} đang hoạt động`}
              icon={Users}
              tone="blue"
              loading={loading}
              failed={statsFailed}
            />
            <StatCard
              label="Tổng số sinh viên"
              value={totalStudents}
              hint="Bấm để quản lý tài khoản sinh viên"
              icon={GraduationCap}
              tone="teal"
              loading={loading}
              failed={statsFailed}
              onClick={() => navigate('/admin/student-accounts')}
              title="Mở trang quản lý tài khoản sinh viên"
            />
            <StatCard
              label="Tổng số Content Manager"
              value={totalCms}
              hint={`${formatNumber(totalAdmins)} tài khoản quản trị`}
              icon={UserCog}
              tone="purple"
              loading={loading}
              failed={statsFailed}
              onClick={() => navigate('/admin/cm-accounts')}
              title="Mở trang quản lý tài khoản Content Manager"
            />
            <StatCard
              label="Tài khoản bị vô hiệu hóa"
              value={inactiveAccounts}
              hint="Không thể đăng nhập cho tới khi mở lại"
              icon={UserX}
              tone={inactiveAccounts > 0 ? 'orange' : 'green'}
              loading={loading}
              failed={statsFailed}
            />
          </div>
        </section>

        {/* ── KHU 2: DANH MỤC NỘI DUNG ────────────────── */}
        <section className="ad-zone">
          <div className="ad-sec-title">
            <Layers size={15} strokeWidth={2.4} />
            <span>Danh mục nội dung học thuật</span>
          </div>

          <div className="ad-stat-grid ad-stat-grid--3">
            <StatCard label="Ngành đang mở" value={stats?.totalMajorsActive} icon={Layers} tone="blue" loading={loading} failed={statsFailed} />
            <StatCard label="Chuyên ngành đang mở" value={stats?.totalSpecsActive} icon={Network} tone="purple" loading={loading} failed={statsFailed} />
            <StatCard label="Chuyên ngành hẹp đã xuất bản" value={stats?.totalNarrowSpecsPublished} icon={BookOpen} tone="green" loading={loading} failed={statsFailed} />
          </div>
        </section>

        {/* ── KHU 3: THU THẬP DỮ LIỆU & TRỌNG SỐ ──────── */}
        <section className="ad-zone">
          <div className="ad-sec-title">
            <Database size={15} strokeWidth={2.4} />
            <span>Thu thập dữ liệu &amp; trọng số thị trường</span>
          </div>

          <div className="ad-row-2">
            {/* Đợt thu thập gần nhất */}
            <div className="ad-card">
              <CardHead
                icon={Download}
                tone={batchFailed ? 'orange' : 'blue'}
                title="Đợt thu thập dữ liệu gần nhất"
                subtitle="Kết quả lần thu thập tin tuyển dụng mới nhất của hệ thống"
              >
                {!loading && latestBatch && (
                  <span className={`cm-tag ${batchTag.cls}`}>
                    {batchFailed
                      ? <XCircle size={11} strokeWidth={2.4} />
                      : <CheckCircle2 size={11} strokeWidth={2.4} />}
                    {' '}{batchTag.label}
                  </span>
                )}
              </CardHead>

              <div className="ad-cb">
                {loading ? (
                  <SkeletonRows rows={4} />
                ) : batchesFailed && !latestBatch ? (
                  <div className="ad-empty">Không tải được danh sách đợt thu thập — đây là lỗi hệ thống, không phải chưa có đợt nào.</div>
                ) : !latestBatch ? (
                  <div className="ad-empty">Chưa có đợt thu thập dữ liệu nào được ghi nhận</div>
                ) : (
                  <div>
                    <div className="ad-srow">
                      <span className="ad-srow-lbl"><CalendarClock size={14} strokeWidth={2.2} /> Hoàn thành lúc</span>
                      <span className="ad-srow-val">{latestBatch.finishedAt || 'Đang chạy'}</span>
                    </div>
                    <div className="ad-srow">
                      <span className="ad-srow-lbl"><Download size={14} strokeWidth={2.2} /> Tin tuyển dụng thu được</span>
                      <span className="ad-srow-val">{latestBatch.totalFetched == null ? 'Chưa đọc được' : `${formatNumber(latestBatch.totalFetched)} tin`}</span>
                    </div>
                    <div className="ad-srow">
                      <span className="ad-srow-lbl"><Filter size={14} strokeWidth={2.2} /> Tin đã chuẩn hóa</span>
                      <span className="ad-srow-val">{latestBatch.totalParsed == null ? 'Chưa đọc được' : `${formatNumber(latestBatch.totalParsed)} tin`}</span>
                    </div>
                    <div className="ad-srow">
                      <span className="ad-srow-lbl"><XCircle size={14} strokeWidth={2.2} /> Tin lỗi</span>
                      <span className="ad-srow-val">{latestBatch.totalErrors == null ? 'Chưa đọc được' : `${formatNumber(latestBatch.totalErrors)} tin`}</span>
                    </div>
                    <div className="ad-srow">
                      <span className="ad-srow-lbl"><PlayCircle size={14} strokeWidth={2.2} /> Nguồn kích hoạt</span>
                      <span className="ad-srow-val ad-srow-val--muted">{latestBatch.triggeredBy}</span>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" className="ad-card-foot" onClick={() => navigate('/admin/crawler')}>
                Cấu hình thu thập dữ liệu <ArrowRight size={14} strokeWidth={2.4} />
              </button>
            </div>

            {/* Đề xuất trọng số */}
            <div className="ad-card">
              <CardHead
                icon={TrendingUp}
                tone="green"
                title="Đề xuất trọng số thị trường"
                subtitle="Tỷ lệ đề xuất do hệ thống sinh ra đã được Content Manager xử lý"
              >
                {!loading && (
                  <span className={`cm-tag ${pendingTw > 0 ? 'cm-tag--orange' : 'cm-tag--green'}`}>
                    {pendingTw > 0 ? `${formatNumber(pendingTw)} chờ duyệt` : 'Không tồn đọng'}
                  </span>
                )}
              </CardHead>

              <div className="ad-cb">
                {loading ? (
                  <SkeletonRows rows={3} />
                ) : (
                  <>
                    <ProposalDonut approved={approvedTw} pending={pendingTw} rejected={rejectedTw} total={totalTw} />
                    <p className="ad-chart-note">
                      {totalTw > 0
                        ? <>Đã xử lý <strong>{formatNumber(approvedTw + rejectedTw)}</strong> trên tổng <strong>{formatNumber(totalTw)}</strong> đề xuất ({percentOf(approvedTw + rejectedTw, totalTw)}%)</>
                        : 'Chưa có đề xuất trọng số nào được sinh ra'}
                    </p>
                    <div className="ad-legend-row">
                      <span className="ad-legend-item">
                        <span className="ad-legend-dot" style={{ background: '#51B848' }} />Đã duyệt <strong>{formatNumber(approvedTw)}</strong>
                      </span>
                      <span className="ad-legend-item">
                        <span className="ad-legend-dot" style={{ background: '#F37021' }} />Chờ duyệt <strong>{formatNumber(pendingTw)}</strong>
                      </span>
                      <span className="ad-legend-item">
                        <span className="ad-legend-dot" style={{ background: '#d93025' }} />Từ chối <strong>{formatNumber(rejectedTw)}</strong>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── KHU 4: TOKEN AI & CẤU HÌNH ──────────────── */}
        <section className="ad-zone">
          <div className="ad-sec-title">
            <Cpu size={15} strokeWidth={2.4} />
            <span>Token AI &amp; cấu hình hệ thống</span>
          </div>

          <div className="ad-row-split">
            {/* Biểu đồ token 4 tháng */}
            <div className="ad-card">
              <CardHead
                icon={Cpu}
                tone="blue"
                title="Mức tiêu thụ token AI 4 tháng gần nhất"
                subtitle={hasRealQuota
                  ? `Hạn mức ${formatNumber(tokenQuota)} token mỗi tháng — chiều cao cột bằng phần hạn mức đã dùng`
                  : `Chưa đọc được hạn mức thật từ hệ thống, đang tạm tính theo ${formatNumber(tokenQuota)} token/tháng`}
              >
                {!loading && (
                  <span className={`cm-tag ${tokenToneName === 'danger' ? 'cm-tag--red' : tokenToneName === 'warn' ? 'cm-tag--orange' : 'cm-tag--blue'}`}>
                    Tháng này {tokenPct}%
                  </span>
                )}
              </CardHead>

              <div className="ad-cb">
                {loading ? (
                  <SkeletonRows rows={1} chart />
                ) : monthlyTokens.length === 0 ? (
                  <div className="ad-empty">Chưa có dữ liệu tiêu thụ token trong 4 tháng gần nhất</div>
                ) : (
                  <div className="ad-token-layout">
                    <div>
                      <TokenMonthlyChart months={monthlyTokens} quota={tokenQuota} />
                      <div className="ad-legend-row">
                        <span className="ad-legend-item">
                          <span className="ad-legend-dot" style={{ background: '#034EA2' }} />Dưới 80% hạn mức
                        </span>
                        <span className="ad-legend-item">
                          <span className="ad-legend-dot" style={{ background: '#F37021' }} />Từ 80% hạn mức
                        </span>
                        <span className="ad-legend-item">
                          <span className="ad-legend-dot" style={{ background: '#d93025' }} />Vượt hạn mức
                        </span>
                      </div>
                    </div>

                    <div className="ad-token-side">
                      <span className="ad-token-side-lbl">Tháng này</span>
                      <span className={`ad-token-side-val${tokenToneName === 'warn' ? ' ad-token-side-val--warn' : tokenToneName === 'danger' ? ' ad-token-side-val--danger' : ''}`}>
                        {tokenPct}%
                      </span>
                      <div className="ad-token-bar-bg">
                        <div
                          className="ad-token-bar-fill"
                          style={{ width: `${Math.min(100, tokenPct)}%`, background: tokenColor }}
                        />
                      </div>
                      <span className="ad-token-side-sub">
                        {formatNumber(tokensThisMonth)} / {formatNumber(tokenQuota)} token
                      </span>

                      <div className="ad-divider" />

                      <div className="ad-srow">
                        <span className="ad-srow-lbl">Nhà cung cấp</span>
                        <span className="ad-srow-val">{aiConfig.provider || (configsFailed ? 'Chưa đọc được' : 'Chưa cấu hình')}</span>
                      </div>
                      <div className="ad-srow">
                        <span className="ad-srow-lbl">Model</span>
                        <span className="ad-srow-val ad-srow-val--muted">{aiConfig.model || (configsFailed ? 'Chưa đọc được' : 'Chưa cấu hình')}</span>
                      </div>
                      {peakMonth && (
                        <div className="ad-srow">
                          <span className="ad-srow-lbl">Tháng cao nhất</span>
                          <span className="ad-srow-val">{peakMonth.label} · {percentOf(peakMonth.tokens, tokenQuota)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button type="button" className="ad-card-foot" onClick={() => navigate('/admin/crawler')}>
                <Settings2 size={14} strokeWidth={2.4} /> Cấu hình AI API
              </button>
            </div>

            {/* Preset bảng điểm */}
            <div className="ad-card">
              <CardHead
                icon={FileText}
                tone="purple"
                title="Cấu hình bảng điểm"
                subtitle="Preset ánh xạ cột file bảng điểm đang được dùng để bóc tách"
              >
                {!loading && activePreset?.isActive && (
                  <span className="cm-tag cm-tag--green">
                    <CheckCircle2 size={11} strokeWidth={2.4} /> Đang áp dụng
                  </span>
                )}
              </CardHead>

              <div className="ad-cb">
                {loading ? (
                  <SkeletonRows rows={4} />
                ) : !activePreset ? (
                  <div className="ad-empty">
                    Không có preset bảng điểm nào đang được kích hoạt. Hãy vào trang Preset bảng điểm để bật một preset.
                  </div>
                ) : (
                  <>
                    <div className="ad-sub-title"><FileText size={12} strokeWidth={2.4} /> Preset đang dùng</div>
                    <div className="ad-srow">
                      <span className="ad-srow-lbl">Tên preset</span>
                      <span className="ad-srow-val">{activePreset.name}</span>
                    </div>
                    {activePreset.updatedAt && (
                      <div className="ad-srow">
                        <span className="ad-srow-lbl">Cập nhật lần cuối</span>
                        <span className="ad-srow-val ad-srow-val--muted">{activePreset.updatedAt}</span>
                      </div>
                    )}

                    <div className="ad-divider" />
                    <div className="ad-sub-title"><Filter size={12} strokeWidth={2.4} /> Ánh xạ cột</div>
                    {activePreset.fields.length === 0 ? (
                      <div className="ad-empty">Preset này chưa ánh xạ cột nào</div>
                    ) : (
                      activePreset.fields.map(field => (
                        <div key={field.label} className="ad-srow">
                          <span className="ad-srow-lbl">{field.label}</span>
                          <span className="ad-srow-val ad-srow-val--muted">{field.column}</span>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>

              <button type="button" className="ad-card-foot" onClick={() => navigate('/admin/transcript-presets')}>
                Quản lý preset bảng điểm <ArrowRight size={14} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </section>

      </div>

      <CmToast toasts={toasts} onDismiss={dismissToast} />
    </Layout>
  )
}
