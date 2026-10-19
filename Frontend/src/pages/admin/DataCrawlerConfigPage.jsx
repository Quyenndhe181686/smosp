import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, Play, RefreshCw, Cpu, Layers, Clock, CalendarClock, CalendarCheck,
  CheckCircle2, XCircle, Save, PlugZap, Gauge, AlertTriangle, Info, Link2, KeyRound, Settings
} from 'lucide-react'
import { logout } from '../../services/authService'
import { getSystemConfigs, updateSystemConfigs, getAiUsageStats, testAiConnection } from '../../services/systemService'
import { runCrawlAll, getCrawlBatches, getActiveCrawlBatches, cancelCrawlBatch, cancelAllCrawlBatches, getCrawlerSources, toggleCrawlerSource, waitForCrawlBatch, getNormalizeStatus } from '../../services/crawlerService'
import CrawlJobList from '../../components/cm/CrawlJobList'
import { STAGE_TO_PHASE } from '../../components/cm/crawlJobMeta'
import Layout from '../../components/layout/Layout'
import CmSelect from '../../components/cm/CmSelect'
import CmToast from '../../components/cm/CmToast'
import useCmToast from '../../components/cm/useCmToast'
import './admin-ui.css'
import './DataCrawlerConfigPage.css'

/* ============================================================
   Hằng số
   ============================================================ */
const CRON_MIN_DAYS = 1
const CRON_MAX_DAYS = 30

const FALLBACK_TOKEN_QUOTA = 5_000_000

// Adapter thật đã hiện thực ở backend (package crawler.adapter)
const IMPLEMENTED_ADAPTERS = ['vietnamworks']

const DEFAULT_SCHEDULE = {
  cronDays: 7,
  lastRunAt: null,
  lastRunStatus: 'IDLE',
  nextRunAt: null,
}

const DEFAULT_SOURCES = [
  { key: 'vietnamworks', name: 'VietnamWorks', version: 'v1.0', enabled: true, lastTest: null },
  { key: 'topdev', name: 'TopDev', version: 'chưa cài đặt', enabled: false, planned: true, lastTest: null },
]

const DEFAULT_AI_PROVIDER = {
  provider: 'Gemini',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-1.5-flash',
  apiKeyMasked: '••••••••',
}

const PROVIDER_OPTIONS = [
  { value: 'Gemini', label: 'Google Gemini' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Claude', label: 'Anthropic Claude' },
]

/* ============================================================
   Helpers
   ============================================================ */
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

/* ============================================================
   Sub-components
   ============================================================ */
function InfoBox({ icon: Icon, label, children }) {
  return (
    <div className="dcc-info-box">
      <span className="dcc-info-lbl"><Icon size={13} strokeWidth={2.4} /> {label}</span>
      <div className="dcc-info-val">{children}</div>
    </div>
  )
}

/* ============================================================
   Main Component
   ============================================================ */
/**
 * Hoi ly do khi dung phien cua NGUOI KHAC. May chu bat buoc co ly do trong
 * truong hop nay, nen hoi truoc con hon de bam xong roi an 400.
 *
 * @returns {string|null} ly do, hoac null neu bam Huy
 */
function askCancelReason(isOwnBatch) {
  if (isOwnBatch) return ''
  const reason = window.prompt(
    'Phien nay do nguoi khac khoi dong. Nhap ly do dung de ho biet vi sao:'
  )
  if (reason === null) return null
  return reason.trim()
}

export default function DataCrawlerConfigPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Admin'

  const { toasts, showToast, dismissToast } = useCmToast()

  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [cronDaysInput, setCronDaysInput] = useState(String(DEFAULT_SCHEDULE.cronDays))
  const [scheduleTimeInput, setScheduleTimeInput] = useState('02:30')
  const [scheduleError, setScheduleError] = useState(null)
  const [savingSchedule, setSavingSchedule] = useState(false)

  const [sources, setSources] = useState(DEFAULT_SOURCES)
  const [testingKey, setTestingKey] = useState(null)
  const [running, setRunning] = useState(false)

  const [aiProvider, setAiProvider] = useState(DEFAULT_AI_PROVIDER)
  const [aiForm, setAiForm] = useState({ ...DEFAULT_AI_PROVIDER, apiKey: '' })
  const [aiError, setAiError] = useState(null)
  const [savingAi, setSavingAi] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [aiTestResult, setAiTestResult] = useState(null)

  const [tokenUsage, setTokenUsage] = useState({ used: 0, quota: FALLBACK_TOKEN_QUOTA })

  /* Tăng lên mỗi khi cần đọc lại trạng thái đợt thu thập gần nhất — sau khi
     chạy thủ công, sau khi đổi chu kỳ, hoặc khi bấm làm mới */
  const [batchToken, setBatchToken] = useState(0)
  const [allBatches, setAllBatches] = useState([])

  const [sourcesError, setSourcesError] = useState(null)
  const refreshLatestBatch = useCallback(() => setBatchToken(t => t + 1), [])

  /* Cac phien dang chay. Truoc day man Admin bam "Chay ngay" xong chi cho im lang
     toi khi hoan tat - khong cho biet dang cao Chuyen nganh nao, toi buoc nao, va
     khong co duong dung lai. Poll giong man Content Manager. */
  const [jobs, setJobs] = useState([])
  const [cancellingIds, setCancellingIds] = useState([])
  const [cancellingAll, setCancellingAll] = useState(false)

  /* Poll cac phien dang chay, 3 giay/lan.

     Chay lien tuc chu khong chi sau khi bam "Chay ngay": phien co the do mot
     Content Manager khac khoi dong, Admin mo trang len phai thay ngay. Dung poll
     khi khong con phien nao de khoi goi API vo ich. */
  useEffect(() => {
    let alive = true
    let timer = null

    const tick = async () => {
      try {
        const list = await getActiveCrawlBatches()
        if (!alive) return
        const batches = Array.isArray(list) ? list : []

        /* Bước chuẩn hóa không có số liệu trong CrawlBatchResponse — phải hỏi
           riêng /normalize-status thì mới hiện được "còn N / xong M" và bảng
           breakdown theo chuyên ngành hẹp, giống hệt màn Content Manager. */
        const withNormalize = await Promise.all(batches.map(async (b) => {
          if (b.stage !== 'NORMALIZING') return { batch: b, normalize: null }
          try {
            return { batch: b, normalize: await getNormalizeStatus(b.id) }
          } catch {
            return { batch: b, normalize: null }
          }
        }))
        if (!alive) return

        setJobs(withNormalize.map(({ batch, normalize }) => ({
          batchId: batch.id,
          label: batch.scopeSpecializationName
            || batch.scopeSpecializationCode
            || 'Chuyen nganh khong xac dinh',
          phase: STAGE_TO_PHASE[batch.stage] || 'CRAWL',
          batch,
          normalize,
          error: null
        })))
      } catch (err) {
        console.error('Khong tai duoc cac phien dang chay:', err)
      }
      if (alive) timer = setTimeout(tick, 3000)
    }
    tick()

    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [batchToken])

  /* Dung 1 phien. Khong tu xoa khoi danh sach o day - de vong poll doc trang thai
     that tu may chu, dat tay se noi doi neu viec dung khong thanh. */
  const handleCancelBatch = async (batchId) => {
    const job = jobs.find(j => j.batchId === batchId)
    const isOwn = job?.batch?.triggeredById === localStorage.getItem('userId')
    const reason = askCancelReason(isOwn)
    if (reason === null) return
    if (!isOwn && !reason) {
      showToast('Phải nhập lý do khi dừng phiên của người khác', 'warning')
      return
    }

    setCancellingIds(prev => [...prev, batchId])
    try {
      await cancelCrawlBatch(batchId, reason)
      showToast('Da gui yeu cau dung, phien se dung trong giay lat', 'info')
    } catch (err) {
      const msg = err.response?.data?.message
      if (err.response?.status === 403) {
        showToast(msg || 'Phien nay do nguoi khac chay, ban khong dung duoc', 'error')
      } else if (err.response?.status === 409) {
        showToast(msg || 'Phien da ket thuc hoac da duoc yeu cau dung truoc do', 'warning')
      } else {
        console.error('Khong dung duoc phien:', err)
        showToast(msg || 'Khong gui duoc yeu cau dung', 'error')
      }
    } finally {
      setCancellingIds(prev => prev.filter(id => id !== batchId))
    }
  }

  /* Dung tat ca. May chu chi dung nhung phien nguoi goi duoc phep dung, va tra ve
     so luong that - hien dung so do thay vi bao chung chung "da dung tat ca". */
  const handleCancelAll = async () => {
    const myId = localStorage.getItem('userId')
    const touchesOthers = jobs.some(j => j.batch?.canCancel === true && j.batch?.triggeredById !== myId)
    const reason = askCancelReason(!touchesOthers)
    if (reason === null) return
    if (touchesOthers && !reason) {
      showToast('Phải nhập lý do khi dừng phiên của người khác', 'warning')
      return
    }

    setCancellingAll(true)
    try {
      const res = await cancelAllCrawlBatches(reason)
      const n = res?.cancelled ?? 0
      showToast(res?.message || `Da gui yeu cau dung ${n} phien`, n > 0 ? 'info' : 'warning')
    } catch (err) {
      console.error('Khong dung duoc cac phien:', err)
      showToast(err.response?.data?.message || 'Khong gui duoc yeu cau dung', 'error')
    } finally {
      setCancellingAll(false)
    }
  }

  /* Đợt thu thập gần nhất — cũng là mốc để suy ra lần chạy kế tiếp */
  useEffect(() => {
    let alive = true
    getCrawlBatches()
      .then((batches) => {
        if (!alive) return
        const list = Array.isArray(batches) ? batches : (batches?.content || [])
        setAllBatches(list)
        if (list.length === 0) return

        const latest = list[0]
        const runAt = latest.finishedAt || latest.startedAt || latest.createdAt
        setSchedule(prev => {
          // 2 effect chạy song song: effect này có thể về TRƯỚC khi đọc xong cấu hình
          // chu kỳ, khi đó `prev.cronDays` còn là mặc định và "Lần chạy kế tiếp" bị tính
          // sai. Chỉ ghi mốc thô ở đây, việc tính nextRunAt để một effect riêng lo (DEF_184).
          return {
            ...prev,
            lastRunAt: formatDateTime(runAt),
            lastRunRawAt: runAt || null,
            lastRunStatus: latest.status || 'SUCCESS',
          }
        })
      })
      .catch((err) => console.error('Không tải được trạng thái đợt thu thập:', err))
    return () => { alive = false }
  }, [batchToken])

  /* Chỉ tính "Lần chạy kế tiếp" khi đã có CẢ mốc chạy gần nhất lẫn chu kỳ đọc được,
     tránh đua giữa 2 effect độc lập (DEF_184) */
  useEffect(() => {
    setSchedule(prev => {
      if (!prev.lastRunRawAt || prev.cronUnreadable || !prev.cronDays) {
        return prev.nextRunAt ? { ...prev, nextRunAt: null } : prev
      }
      const next = new Date(prev.lastRunRawAt)
      next.setDate(next.getDate() + prev.cronDays)
      // Gắn giờ phút đã cấu hình vào mốc kế tiếp nếu có
      if (prev.scheduleTime) {
        const [hh, mm] = prev.scheduleTime.split(':').map(Number)
        next.setHours(hh, mm, 0, 0)
      }
      const value = next.toLocaleString('vi-VN')
      return prev.nextRunAt === value ? prev : { ...prev, nextRunAt: value }
    })
  }, [schedule.lastRunRawAt, schedule.cronDays, schedule.cronUnreadable, schedule.scheduleTime])

  useEffect(() => {
    getSystemConfigs()
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return
        const config = Object.fromEntries(data.map(item => [item.configKey, item.configValue]))

        if (config.crawler_schedule) {
          const parsed = parseInt(config.crawler_schedule, 10)
          if (Number.isFinite(parsed) && parsed > 0) {
            setCronDaysInput(String(parsed))
            setSchedule(s => ({ ...s, cronDays: parsed, cronRaw: config.crawler_schedule, cronUnreadable: false }))
          } else {
            // Rơi ngầm về 7 ngày che mất cấu hình thật đang lưu trên hệ thống (DEF_183)
            console.warn('Không đọc được cấu hình chu kỳ crawl:', config.crawler_schedule)
            setCronDaysInput('')
            setSchedule(s => ({ ...s, cronRaw: config.crawler_schedule, cronUnreadable: true }))
          }
        }

        if (config.crawler_schedule_time) {
          setScheduleTimeInput(config.crawler_schedule_time)
          setSchedule(s => ({ ...s, scheduleTime: config.crawler_schedule_time }))
        }

        const normalizeProvider = (p) => {
          if (!p) return 'Gemini';
          return p.trim().toLowerCase() === 'openai' ? 'OpenAI' : 'Gemini';
        };

        const resolvedProvider = config.ai_provider ? normalizeProvider(config.ai_provider) : undefined;

        setAiProvider(prev => ({
          provider: resolvedProvider || prev.provider,
          endpoint: config.ai_endpoint || prev.endpoint,
          model: config.ai_model || prev.model,
          apiKeyMasked: config.ai_api_key_masked || prev.apiKeyMasked,
        }))
        setAiForm(prev => ({
          ...prev,
          provider: resolvedProvider || prev.provider,
          endpoint: config.ai_endpoint || prev.endpoint,
          model: config.ai_model || prev.model,
        }))

        if (config.crawler_adapters) {
          try {
            const saved = JSON.parse(config.crawler_adapters)
            if (Array.isArray(saved)) setSources(saved)
          } catch {
            console.warn('Cấu hình nguồn dữ liệu đã lưu không đọc được, dùng danh sách mặc định')
          }
        }
      })
      .catch((err) => console.error('Không tải được cấu hình hệ thống:', err))

    getCrawlerSources()
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return
        setSourcesError(null)
        setSources(data.map(source => {
          const key = source.adapterKey || source.name.toLowerCase().replace(/\s+/g, '')
          return {
            id: source.id,
            key,
            name: source.name,
            // `CrawlerSourceResponse` không có field version — hiện lịch cron hoặc chuỗi
            // cứng 'v1.0' ở cột "Phiên bản trình đọc" là bịa. Hiển thị adapterKey thật,
            // đúng thứ FE biết chắc (DEF_187).
            adapterKey: source.adapterKey || null,
            scheduleCron: source.scheduleCron || null,
            enabled: source.isEnabled ?? true,
            // Nguồn có adapterKey không nằm trong danh sách đã hiện thực = chưa tích hợp (DEF_185)
            planned: !IMPLEMENTED_ADAPTERS.includes(String(source.adapterKey || '').toLowerCase()),
            lastTest: source.lastRunAt
              ? { status: source.lastBatchStatus || 'SUCCESS', at: formatDateTime(source.lastRunAt) }
              : null,
          }
        }))
      })
      .catch((err) => {
        // console.debug rồi giữ nguyên 2 nguồn mặc định cứng khiến Admin tưởng đó là
        // cấu hình thật đang chạy (DEF_188)
        console.error('Không lấy được nguồn dữ liệu từ server:', err)
        setSourcesError(err.response?.data?.message || 'Không tải được danh sách nguồn dữ liệu từ hệ thống.')
        setSources([])
      })

    getAiUsageStats()
      .then((stats) => {
        if (stats && stats.totalTokens !== undefined) {
          setTokenUsage({
            used: stats.totalTokens,
            quota: stats.quotaTokens || FALLBACK_TOKEN_QUOTA,
          })
        }
      })
      .catch((err) => console.error('Không tải được số liệu token AI:', err))
  }, [])

  /* ── Lịch chạy tự động ── */
  const handleSaveSchedule = async (e) => {
    e.preventDefault()
    const days = Number(cronDaysInput)
    if (!Number.isInteger(days) || days < CRON_MIN_DAYS || days > CRON_MAX_DAYS) {
      setScheduleError(`Chu kỳ thu thập phải nằm trong khoảng ${CRON_MIN_DAYS}–${CRON_MAX_DAYS} ngày`)
      return
    }
    // Validate giờ phút HH:mm
    if (!scheduleTimeInput || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(scheduleTimeInput)) {
      setScheduleError('Giờ chạy không hợp lệ — vui lòng nhập đúng định dạng HH:mm (ví dụ: 02:30)')
      return
    }

    setSavingSchedule(true)
    try {
      await updateSystemConfigs([
        { configKey: 'crawler_schedule', configValue: String(days) },
        { configKey: 'crawler_schedule_time', configValue: scheduleTimeInput },
      ])
      setSchedule(s => ({ ...s, cronDays: days, scheduleTime: scheduleTimeInput }))
      setScheduleError(null)
      showToast(`Đã lưu lịch thu thập: ${days} ngày một lần, lúc ${scheduleTimeInput}`, 'success')
      refreshLatestBatch()
    } catch (err) {
      console.error('Không lưu được lịch thu thập:', err)
      setScheduleError(err.response?.data?.message || 'Không thể lưu cấu hình lịch thu thập')
    } finally {
      setSavingSchedule(false)
    }
  }

  /* ── Chạy thu thập thủ công ── */
  const handleRunNow = async () => {
    if (running) return
    setRunning(true)
    try {
      showToast('Đang kích hoạt đợt thu thập thủ công...', 'info')

      // try/catch nội bộ nuốt lỗi thật rồi rơi xuống cảnh báo chung chung
      // "chưa có đợt nào được tạo" — che mất nguyên nhân thật (DEF_190)
      let result = null
      try {
        result = await runCrawlAll()
      } catch (err) {
        console.error('Không gọi được thu thập toàn bộ nguồn:', err)
        showToast(
          err.response?.data?.message || 'Không kích hoạt được đợt thu thập: máy chủ từ chối yêu cầu chạy tất cả nguồn.',
          'error'
        )
        return
      }

      const batchIds = []
      if (result && Array.isArray(result.results)) {
        result.results.forEach(item => {
          if (item.success && item.batch?.id) batchIds.push(item.batch.id)
        })
      } else if (result?.id) {
        batchIds.push(result.id)
      }

      if (batchIds.length > 0) {
        showToast(`Đã đưa ${batchIds.length} đợt thu thập vào hàng đợi, đang theo dõi tiến độ...`, 'info')
        const finished = await Promise.all(batchIds.map(id => waitForCrawlBatch(id)))
        // waitForCrawlBatch nay coi CANCELLED la trang thai ket thuc, nen bao
        // "hoan tat" tron o khong con dung khi nguoi dung da bam dung giua chung.
        const stopped = finished.filter(b => b?.status === 'CANCELLED').length
        if (stopped === batchIds.length) {
          showToast('Đã dừng toàn bộ đợt thu thập theo yêu cầu', 'warning')
        } else if (stopped > 0) {
          showToast(`Hoàn tất ${batchIds.length - stopped} đợt, ${stopped} đợt đã bị dừng`, 'info')
        } else {
          showToast('Tất cả đợt thu thập thủ công đã hoàn tất', 'success')
        }
      } else {
        showToast('Đã kích hoạt nhưng chưa có đợt thu thập nào được tạo — kiểm tra lại cấu hình nguồn dữ liệu', 'warning')
      }

      refreshLatestBatch()
    } catch (err) {
      console.error('Không kích hoạt được đợt thu thập:', err)
      showToast(err.response?.data?.message || 'Không thể kích hoạt đợt thu thập', 'error')
    } finally {
      setRunning(false)
    }
  }

  /* ── Bật / tắt nguồn dữ liệu ── */
  const handleToggleSource = async (key) => {
    const target = sources.find(s => s.key === key || s.id === key)
    if (!target) return

    const updated = sources.map(s => (s.key === key || s.id === key ? { ...s, enabled: !s.enabled } : s))
    setSources(updated)

    try {
      if (target.id) {
        await toggleCrawlerSource(target.id)
      } else {
        await updateSystemConfigs([{ configKey: 'crawler_adapters', configValue: JSON.stringify(updated) }])
      }
      showToast(`Đã ${target.enabled ? 'tắt' : 'bật'} nguồn dữ liệu ${target.name}`, target.enabled ? 'warning' : 'success')
    } catch (err) {
      console.error('Không cập nhật được trạng thái nguồn dữ liệu:', err)
      setSources(sources)
      // 409 = nguồn đang bận chạy; message thật của backend giải thích rõ hơn
      // thông điệp chung chung (DEF_191)
      showToast(
        err.response?.data?.message ||
        (err.response?.status === 409
          ? `Nguồn ${target.name} đang chạy một đợt thu thập nên chưa đổi được trạng thái.`
          : 'Không thể cập nhật trạng thái nguồn dữ liệu'),
        'error'
      )
    }
  }

  /* Backend hiện chỉ có GET /admin/crawler-sources, PUT /{id}, PATCH /{id}/toggle —
     KHÔNG có endpoint kiểm tra kết nối. Bản cũ setTimeout 900ms rồi báo SUCCESS là kết
     quả bịa hoàn toàn, 0 request mạng (DEF_186). Ở đây dùng đúng thứ backend có: đọc lại
     danh sách nguồn và báo theo trạng thái đợt chạy gần nhất, đồng thời nói rõ đây không
     phải phép thử kết nối trực tiếp. */
  const handleTestSource = async (key) => {
    const target = sources.find(s => s.key === key || s.id === key)
    setTestingKey(key)
    try {
      const data = await getCrawlerSources()
      const fresh = Array.isArray(data)
        ? data.find(x => x.id === target?.id || x.adapterKey === target?.key)
        : null
      if (!fresh) {
        showToast(`Không tìm thấy nguồn ${target?.name || key} trên hệ thống`, 'error')
        return
      }
      const status = fresh.lastBatchStatus || null
      const ok = status === 'SUCCESS' || status === 'COMPLETED'
      setSources(prev => prev.map(s => (
        (s.key === key || s.id === key)
          ? { ...s, lastTest: { status: status || 'UNKNOWN', at: formatDateTime(fresh.lastRunAt) || new Date().toLocaleString('vi-VN') } }
          : s
      )))
      showToast(
        status
          ? `Đợt thu thập gần nhất của ${fresh.name}: ${status}${ok ? '' : ' — nguồn có thể đang gặp vấn đề'}`
          : `${fresh.name} chưa từng chạy đợt thu thập nào nên chưa có tín hiệu để đánh giá`,
        ok ? 'success' : 'warning'
      )
    } catch (err) {
      console.error('Không kiểm tra được nguồn dữ liệu:', err)
      showToast(err.response?.data?.message || 'Không kiểm tra được nguồn dữ liệu', 'error')
    } finally {
      setTestingKey(null)
    }
  }

  /* ── Cấu hình AI API ── */
  const handleSaveAiProvider = async (e) => {
    e.preventDefault()
    if (!aiForm.endpoint.trim() || !aiForm.model.trim()) {
      setAiError('Endpoint và tên model là bắt buộc')
      return
    }

    setSavingAi(true)
    try {
      const payload = [
        { configKey: 'ai_provider', configValue: aiForm.provider },
        { configKey: 'ai_endpoint', configValue: aiForm.endpoint.trim() },
        { configKey: 'ai_model', configValue: aiForm.model.trim() },
      ]
      const masked = aiForm.apiKey.trim() ? `••••••••${aiForm.apiKey.trim().slice(-4)}` : null
      if (masked) payload.push({ configKey: 'ai_api_key_masked', configValue: masked })

      await updateSystemConfigs(payload)
      setAiProvider(prev => ({
        provider: aiForm.provider,
        endpoint: aiForm.endpoint.trim(),
        model: aiForm.model.trim(),
        apiKeyMasked: masked || prev.apiKeyMasked,
      }))
      setAiForm(f => ({ ...f, apiKey: '' }))
      setAiError(null)
      // Cấu hình vừa đổi thì kết quả kiểm tra cũ không còn nói lên điều gì.
      setAiTestResult(null)
      showToast('Đã áp dụng cấu hình AI API', 'success')
    } catch (err) {
      console.error('Không lưu được cấu hình AI API:', err)
      setAiError(err.response?.data?.message || 'Không thể lưu cấu hình AI API')
    } finally {
      setSavingAi(false)
    }
  }

  /**
   * AC-56-03 — kiểm tra cấu hình AI vừa lưu có gọi được thật không.
   *
   * Kiểm tra endpoint/model ĐANG LƯU trên server, không phải giá trị đang gõ dở
   * trong form — nên phải bấm Lưu trước rồi mới kiểm tra mới có nghĩa.
   */
  const handleTestAiConnection = async () => {
    setTestingAi(true)
    setAiTestResult(null)
    try {
      const result = await testAiConnection()
      setAiTestResult(result)
      showToast(
        result.success ? `Kết nối AI thành công (${result.latencyMs}ms)` : 'Không kết nối được tới AI',
        result.success ? 'success' : 'error'
      )
    } catch (err) {
      console.error('Không kiểm tra được kết nối AI:', err)
      const message = err.response?.data?.message || 'Không gọi được API kiểm tra kết nối'
      setAiTestResult({ success: false, message })
      showToast(message, 'error')
    } finally {
      setTestingAi(false)
    }
  }

  const handleLogout = async () => { await logout(); navigate('/login') }

  const tokenPct = percentOf(tokenUsage.used, tokenUsage.quota)
  const tokenColor = tokenPct >= 100 ? '#d93025' : tokenPct >= 80 ? '#F37021' : '#034EA2'
  const lastRunFailed = schedule.lastRunStatus === 'FAILED'
  /* Phien bi dung khong phai that bai, cung khong phai thanh cong. */
  const lastRunCancelled = schedule.lastRunStatus === 'CANCELLED'
  const neverRun = !schedule.lastRunAt

  const enabledSources = useMemo(() => sources.filter(s => s.enabled).length, [sources])

  return (
    <Layout
      role="admin"
      user={{ name: username }}
      onLogout={handleLogout}
      onLogoClick={() => navigate('/')}
      onGoHome={() => navigate('/')}
    >
      <div className="adm-page">

        {/* ── ĐẦU TRANG ── */}
        <header className="adm-head">
          <div className="adm-head-main">
            <span className="adm-head-icon"><Settings size={20} strokeWidth={2.2} /></span>
            <div>
              <h1 className="adm-title">Thu thập dữ liệu thị trường</h1>
              <p className="adm-sub">
                Lịch chạy tự động, nguồn tin tuyển dụng và dịch vụ AI dùng để chuẩn hóa dữ liệu thu được
              </p>
            </div>
          </div>
          <div className="adm-head-actions">
            <button type="button" className="cm-btn cm-btn--secondary" onClick={refreshLatestBatch}>
              <RefreshCw size={14} strokeWidth={2.4} /> Làm mới trạng thái
            </button>
            <button type="button" className="cm-btn cm-btn--primary" onClick={handleRunNow} disabled={running}>
              {running
                ? <><RefreshCw size={14} strokeWidth={2.4} className="adm-spin" /> Đang thu thập...</>
                : <><Play size={14} strokeWidth={2.4} /> Chạy thu thập ngay</>}
            </button>
          </div>
        </header>

        {/* ── KHU 0: PHIÊN ĐANG CHẠY ──
             Chỉ hiện khi thực sự có phiên, để lúc bình thường màn không bị chiếm chỗ */}
        {jobs.length > 0 && (
          <section className="adm-card dcc-live">
            <div className="adm-card-head">
              <span className="adm-card-icon"><RefreshCw size={18} strokeWidth={2.2} className="adm-spin" /></span>
              <div className="adm-card-titles">
                <h2 className="adm-card-title">Đang thu thập dữ liệu</h2>
                <p className="adm-card-sub">
                  {jobs.length} phiên đang chạy — cập nhật mỗi 3 giây
                </p>
              </div>
              <button
                type="button"
                className="cm-btn cm-btn--secondary dcc-stop-all"
                onClick={handleCancelAll}
                disabled={cancellingAll}
              >
                <XCircle size={14} strokeWidth={2.4} />
                {cancellingAll ? 'Đang gửi...' : 'Dừng tất cả'}
              </button>
            </div>

            <CrawlJobList
              jobs={jobs}
              onCancel={handleCancelBatch}
              cancellingIds={cancellingIds}
            />
          </section>
        )}

        {/* ── KHU 1: LỊCH CHẠY TỰ ĐỘNG ── */}
        <section className="adm-card">
          <div className="adm-card-head">
            <span className="adm-card-icon"><Clock size={18} strokeWidth={2.2} /></span>
            <div className="adm-card-titles">
              <h3 className="adm-card-title">Lịch thu thập tự động</h3>
              <p className="adm-card-sub">Hệ thống tự thu thập tin tuyển dụng theo chu kỳ; chạy thủ công không làm đổi lịch</p>
            </div>
            <div className="adm-card-actions">
              <span className={`cm-tag ${neverRun ? 'cm-tag--neutral' : lastRunFailed ? 'cm-tag--red' : lastRunCancelled ? 'cm-tag--neutral' : 'cm-tag--green'}`}>
                {neverRun
                  ? 'Chưa chạy lần nào'
                  : lastRunFailed
                    ? <><XCircle size={11} strokeWidth={2.4} /> Lần chạy gần nhất thất bại</>
                    : lastRunCancelled
                      ? <><XCircle size={11} strokeWidth={2.4} /> Lần chạy gần nhất đã bị dừng</>
                      : <><CheckCircle2 size={11} strokeWidth={2.4} /> Lần chạy gần nhất thành công</>}
              </span>
            </div>
          </div>

          <div className="adm-cb">
            <div className="dcc-info-grid">
              <InfoBox icon={CalendarClock} label="Chu kỳ thu thập">
                {schedule.cronUnreadable
                  ? `Không đọc được cấu hình (giá trị lưu: "${schedule.cronRaw}")`
                  : `${schedule.cronDays} ngày một lần`}
              </InfoBox>
              <InfoBox icon={Clock} label="Lần chạy gần nhất">
                {schedule.lastRunAt || 'Chưa có dữ liệu'}
              </InfoBox>
              <InfoBox icon={CalendarCheck} label="Lần chạy kế tiếp (dự kiến)">
                {schedule.nextRunAt || 'Chưa đủ dữ liệu để tính (cần mốc chạy gần nhất và chu kỳ hợp lệ)'}
              </InfoBox>
            </div>

            <div className="adm-divider" />

            <form className="dcc-cron-form" onSubmit={handleSaveSchedule}>
              <div className="adm-field dcc-cron-field">
                <label className="adm-field-label" htmlFor="dcc-cron-days">
                  <CalendarClock size={12} strokeWidth={2.4} /> Chu kỳ thu thập (ngày)
                </label>
                <div className="dcc-cron-input-row">
                  <input
                    id="dcc-cron-days"
                    className="adm-input adm-input--sm"
                    type="text"
                    inputMode="numeric"
                    value={cronDaysInput}
                    onChange={(e) => setCronDaysInput(e.target.value)}
                  />
                  <span className="dcc-cron-sep">ngày, lúc</span>
                  <input
                    id="dcc-cron-time"
                    className="adm-input adm-input--sm adm-input--time"
                    type="time"
                    value={scheduleTimeInput}
                    onChange={(e) => setScheduleTimeInput(e.target.value)}
                  />
                  <button type="submit" className="cm-btn cm-btn--primary" disabled={savingSchedule}>
                    <Save size={14} strokeWidth={2.4} /> {savingSchedule ? 'Đang lưu...' : 'Lưu lịch'}
                  </button>
                  <span className="dcc-cron-hint">
                    <Info size={13} strokeWidth={2.4} />
                    Tối thiểu {CRON_MIN_DAYS} ngày, tối đa {CRON_MAX_DAYS} ngày để không quá tải nguồn dữ liệu
                  </span>
                </div>
              </div>

              {scheduleError && (
                <div className="adm-form-error">
                  <AlertTriangle size={14} strokeWidth={2.4} />
                  <span>{scheduleError}</span>
                </div>
              )}
            </form>
          </div>
        </section>

        {/* ── KHU 2: NGUỒN DỮ LIỆU ── */}
        <section className="adm-card">
          <div className="adm-card-head">
            <span className="adm-card-icon adm-card-icon--purple"><Layers size={18} strokeWidth={2.2} /></span>
            <div className="adm-card-titles">
              <h3 className="adm-card-title">Nguồn tin tuyển dụng</h3>
              <p className="adm-card-sub">Chỉ nguồn đang bật mới được đưa vào đợt thu thập tiếp theo</p>
            </div>
            <div className="adm-card-actions">
              <span className={`cm-tag ${enabledSources > 0 ? 'cm-tag--green' : 'cm-tag--orange'}`}>
                {enabledSources} / {sources.length} nguồn đang bật
              </span>
            </div>
          </div>

          <div className="adm-cb adm-cb--flush">
            <div className="adm-table-wrap">
              <table className="adm-table dcc-source-table">
                <thead>
                  <tr>
                    <th>Nguồn dữ liệu</th>
                    <th>Mã trình đọc (adapter)</th>
                    <th>Lần kiểm tra kết nối gần nhất</th>
                    <th className="adm-th-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sourcesError && (
                    <tr>
                      <td colSpan={4} style={{ color: '#B91C1C' }}>
                        {sourcesError} Đây là lỗi tải dữ liệu — danh sách bên dưới không phản ánh cấu hình thật.
                      </td>
                    </tr>
                  )}
                  {!sourcesError && sources.length === 0 && (
                    <tr><td colSpan={4}>Chưa có nguồn dữ liệu nào được cấu hình.</td></tr>
                  )}
                  {sources.map((source) => (
                    <tr key={source.key}>
                      <td>
                        <div className="adm-user-name">
                          {source.name}
                          {source.planned && <span className="cm-tag cm-tag--neutral dcc-planned-tag">Chưa tích hợp</span>}
                        </div>
                        <div className="adm-user-sub">{source.key}</div>
                      </td>
                      {/* Backend không trả version — hiện adapterKey thật thay vì bịa 'v1.0' (DEF_187) */}
                      <td><span className="dcc-code">{source.adapterKey || 'Chưa rõ'}</span></td>
                      <td>
                        {source.lastTest ? (
                          <div className="dcc-test-info">
                            <span className="cm-tag cm-tag--green">
                              <CheckCircle2 size={11} strokeWidth={2.4} /> Kết nối được
                            </span>
                            <span className="adm-user-sub">{source.lastTest.at}</span>
                          </div>
                        ) : (
                          <span className="adm-muted">Chưa kiểm tra</span>
                        )}
                      </td>
                      <td className="adm-td-right">
                        <div className="adm-row-actions">
                          <button
                            type="button"
                            className="cm-btn cm-btn--secondary cm-btn--sm"
                            disabled={source.planned || testingKey === source.key}
                            onClick={() => handleTestSource(source.key)}
                            title={source.planned ? 'Nguồn chưa được tích hợp' : `Kiểm tra kết nối tới ${source.name}`}
                          >
                            <PlugZap size={13} strokeWidth={2.4} />
                            {testingKey === source.key ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                          </button>
                          <button
                            type="button"
                            className={`dcc-toggle${source.enabled ? ' dcc-toggle--on' : ' dcc-toggle--off'}`}
                            disabled={source.planned}
                            onClick={() => handleToggleSource(source.key)}
                            role="switch"
                            aria-checked={source.enabled}
                            aria-label={`${source.name} ${source.enabled ? 'đang bật' : 'đang tắt'}`}
                            title={source.enabled ? 'Tắt nguồn dữ liệu này' : 'Bật nguồn dữ liệu này'}
                          >
                            <span className="dcc-toggle-knob" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>


      </div>

      <CmToast toasts={toasts} onDismiss={dismissToast} />
    </Layout>
  )
}