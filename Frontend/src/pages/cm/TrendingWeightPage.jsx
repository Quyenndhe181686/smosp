import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../services/authService'
import {
  RefreshCw,
  Loader2,
  Play,
  Database,
  FilterX,
  Search,
  ChevronDown,
  XCircle,
  TrendingUp,
  History
} from 'lucide-react'
import {
  getTrendingWeightProposals,
  approveTrendingWeightProposal,
  rejectTrendingWeightProposal,
  bulkApproveTrendingWeightProposals,
  bulkRejectTrendingWeightProposals,
  rollbackTrendingWeight,
  runCrawl,
  runCrawlAll,
  getActiveCrawlBatches,
  cancelCrawlBatch,
  cancelAllCrawlBatches,
  pollCrawlBatch,
  pollNormalizeStatus,
  pollBatchStage
} from '../../services/crawlerService'
import {
  getMajors,
  getSpecializationsByMajor,
  getNarrowSpecsBySpecialization
} from '../../services/catalogService'
import Layout from '../../components/layout/Layout'
import CmPagination from '../../components/cm/CmPagination'
import CrawlJobList from '../../components/cm/CrawlJobList'
import { STAGE_TO_PHASE } from '../../components/cm/crawlJobMeta'
import './TrendingWeightPage.css'

const CRAWL_TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']

function delta(from, to) {
  const d = to - from
  return { d, sign: d > 0 ? '+' : '', cls: d > 0 ? 'tw-up' : d < 0 ? 'tw-down' : 'tw-flat' }
}

function toArray(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.content)) return data.content
  return []
}

/* Sacc và junior ratio từ máy chủ là TỶ LỆ (0.42 = 42%), đã nhân 100 ở mapItem. */
function fmtPct(v) {
  const n = Number(v || 0)
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function truncate(text, maxLen = 30) {
  if (!text) return ''
  return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text
}

function formatDateTime(t) {
  const date = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Gom đề xuất theo ĐỢT CÀO THẬT (crawl_batch_id do máy chủ trả về).
 *
 * Trước đây hàm này tự đoán "đợt" bằng cách cụm các đề xuất có thời điểm tạo cách
 * nhau dưới 90 giây. Một lần bấm "Thu thập tất cả ngành" bắn hàng chục chuyên
 * ngành nhưng chỉ chạy 2 luồng song song, nên chúng hoàn tất rải rác suốt hàng
 * chục phút — đúng MỘT lần cào bị cắt vụn thành hàng chục "đợt" giả, và CM phải
 * bấm "Duyệt tất cả" hàng chục lần cho một lần cào.
 *
 * Đề xuất tạo ngoài pipeline (calculate thủ công, khôi phục sau restart) không gắn
 * batch nào — gom chung vào một nhóm "không thuộc đợt cào nào" thay vì bịa ra đợt
 * cho chúng.
 */
function getBatchGroups(items) {
  if (!items || items.length === 0) return []

  const byBatch = new Map()

  items.forEach(item => {
    const key = item.crawlBatchId || 'NO_BATCH'
    let batch = byBatch.get(key)
    if (!batch) {
      batch = {
        id: key,
        rawDate: item.batchStartedAt || item.rawDate || 0,
        scopeName: item.batchScopeName || '',
        performer: item.batchTriggeredBy || '',
        items: []
      }
      byBatch.set(key, batch)
    }
    batch.items.push(item)
  })

  return [...byBatch.values()]
    .sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0))
    .map(batch => {
      if (batch.id === 'NO_BATCH') {
        return {
          ...batch,
          dateStr: '',
          label: `Không thuộc đợt cào nào (${batch.items.length} CNH)`
        }
      }
      const dateStr = batch.rawDate ? formatDateTime(batch.rawDate) : ''
      const scopeText = batch.scopeName ? `${batch.scopeName} — ` : ''
      const performerText = batch.performer ? ` bởi ${batch.performer}` : ''
      return {
        ...batch,
        dateStr,
        label: `${scopeText}${dateStr}${performerText} (${batch.items.length} CNH)`
      }
    })
}

/**
 * Hoi ly do khi dung phien cua NGUOI KHAC.
 *
 * May chu bat buoc co ly do trong truong hop nay (nguoi bi dung chi co dong nay
 * de hieu chuyen gi vua xay ra), nen hoi truoc con hon de ho bam xong roi an 400.
 * Tu dung phien cua minh thi khong hoi - khong phai giai trinh voi ai.
 *
 * @returns {string|null} ly do, hoac null neu nguoi dung bam Huy
 */
function askCancelReason(isOwnBatch) {
  if (isOwnBatch) return ''
  const reason = window.prompt(
    'Phien nay do nguoi khac khoi dong. Nhap ly do dung de ho biet vi sao:'
  )
  if (reason === null) return null
  return reason.trim()
}

export default function TrendingWeightPage() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'CM'

  const [proposals, setProposals] = useState([])
  const [historyList, setHistoryList] = useState([])
  const [loading, setLoading] = useState(true)
  const [decided, setDecided] = useState({})
  const [toast, setToast] = useState(null)

  const [majors, setMajors] = useState([])
  const [specs, setSpecs] = useState([])

  const [majorId, setMajorId] = useState('')
  const [selectedSpecIds, setSelectedSpecIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  /* Mặc định XEM TẤT CẢ, không phải "đợt gần nhất".
     Máy chủ nay chỉ giữ tối đa MỘT đề xuất chờ duyệt cho mỗi CNH (bản cũ tự chuyển
     SUPERSEDED khi có đợt tính mới), nên "tất cả đang chờ duyệt" là một danh sách
     hữu hạn và đúng nghĩa. Mặc định lọc theo đợt gần nhất như trước là thứ đã giấu
     phần còn lại: duyệt hết đợt đang xem thì đợt cũ hơn trồi lên, nhìn như hệ thống
     tự đẻ thêm đề xuất. */
  const [selectedBatchId, setSelectedBatchId] = useState('ALL')
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false)
  const specDropdownRef = useRef(null)

  /* Trạng thái crawler */
  const [checkingCrawler, setCheckingCrawler] = useState(true) // đang dò xem có phiên nào chạy dở không
  const [isCrawling, setIsCrawling] = useState(false)
  const [runningScope, setRunningScope] = useState(null) // 'ALL' | 'SPEC' | 'RESUME'
  const [jobs, setJobs] = useState([]) // tiến trình từng batch
  const [cancellingIds, setCancellingIds] = useState([]) // batchId đang gửi yêu cầu dừng
  const [cancellingAll, setCancellingAll] = useState(false)

  const nsMapRef = useRef(new Map())
  const specNameRef = useRef(new Map())
  const aliveRef = useRef(true)
  const pollStopsRef = useRef(new Set())

  const showToast = useCallback((msg) => {
    if (!aliveRef.current) return
    setToast(msg)
    setTimeout(() => {
      if (aliveRef.current) setToast(null)
    }, 4000)
  }, [])

  /**
   * Xin dừng một phiên crawl.
   *
   * Máy chủ chỉ ghi nhận yêu cầu (202), luồng crawl thoát ở trang kế tiếp — nên
   * KHÔNG tự đặt phase thành CANCELLED ở đây. Vòng poll đang chạy sẽ đọc status
   * thật rồi cập nhật; đặt tay sẽ nói dối người dùng nếu việc dừng không thành.
   */
  const handleCancelJob = useCallback(async (batchId) => {
    const job = jobs.find(j => j.batchId === batchId)
    const isOwn = job?.batch?.triggeredById === localStorage.getItem('userId')
    const reason = askCancelReason(isOwn)
    if (reason === null) return
    if (!isOwn && !reason) {
      showToast('Phải nhập lý do khi dừng phiên của người khác')
      return
    }

    setCancellingIds(prev => [...prev, batchId])
    try {
      await cancelCrawlBatch(batchId, reason)
      showToast('Đã gửi yêu cầu dừng — phiên sẽ dừng trong giây lát')
    } catch (err) {
      const status = err.response?.status
      const serverMsg = err.response?.data?.message
      if (status === 403) {
        // Phiên của người khác. Máy chủ là nơi quyết định, nút chỉ là lớp gợi ý —
        // gặp 403 nghĩa là dữ liệu trên màn đã cũ, nên báo rõ thay vì nuốt lỗi.
        showToast(serverMsg || 'Phiên này do người khác chạy, bạn không dừng được')
      } else if (status === 409) {
        showToast(serverMsg || 'Phiên đã kết thúc hoặc đã được yêu cầu dừng trước đó')
      } else {
        console.error('Cancel crawl failed:', err)
        showToast(serverMsg || 'Không gửi được yêu cầu dừng, vui lòng thử lại')
      }
    } finally {
      if (aliveRef.current) {
        setCancellingIds(prev => prev.filter(id => id !== batchId))
      }
    }
  }, [showToast, jobs])

  /* Dung moi phien NGUOI DUNG NAY duoc phep dung.
     May chu tra ve so phien that su da dung - hien dung so do thay vi bao chung
     chung "da dung tat ca", vi Content Manager khong dung duoc phien nguoi khac. */
  const handleCancelAll = useCallback(async () => {
    const myId = localStorage.getItem('userId')
    const touchesOthers = jobs.some(j => j.batch?.canCancel === true && j.batch?.triggeredById !== myId)
    const reason = askCancelReason(!touchesOthers)
    if (reason === null) return
    if (touchesOthers && !reason) {
      showToast('Phải nhập lý do khi dừng phiên của người khác')
      return
    }

    setCancellingAll(true)
    try {
      const res = await cancelAllCrawlBatches(reason)
      const n = res?.cancelled ?? 0
      showToast(res?.message || (n > 0
        ? `Đã gửi yêu cầu dừng ${n} phiên`
        : 'Không có phiên nào bạn được phép dừng'))
    } catch (err) {
      console.error('Cancel all failed:', err)
      showToast(err.response?.data?.message || 'Không gửi được yêu cầu dừng')
    } finally {
      if (aliveRef.current) setCancellingAll(false)
    }
  }, [showToast, jobs])

  /* Hủy toàn bộ polling khi rời trang */
  useEffect(() => {
    aliveRef.current = true
    const stops = pollStopsRef.current
    return () => {
      aliveRef.current = false
      stops.forEach(stop => stop())
      stops.clear()
    }
  }, [])

  /* Đóng dropdown Chuyên ngành khi click ra ngoài */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (specDropdownRef.current && !specDropdownRef.current.contains(e.target)) {
        setSpecDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ───────────────────────── Catalog ─────────────────────────
  useEffect(() => {
    getMajors()
      .then(data => {
        const activeMajors = toArray(data).filter(m => m.isActive)
        setMajors(activeMajors)
      })
      .catch(err => console.error('Failed to load majors:', err))
  }, [])

  useEffect(() => {
    if (!majorId) {
      setSpecs([])
      setSelectedSpecIds([])
      return
    }
    getSpecializationsByMajor(majorId)
      .then(data => {
        const activeSpecs = toArray(data).filter(s => s.isActive)
        activeSpecs.forEach(s => specNameRef.current.set(s.id, s.name))
        setSpecs(activeSpecs)
        setSelectedSpecIds([])
      })
      .catch(err => console.error('Failed to load specs:', err))
  }, [majorId])

  const availableSpecs = useMemo(() => {
    if (majorId) return specs
    const list = []
    specNameRef.current.forEach((name, id) => {
      list.push({ id, name })
    })
    return list
  }, [majorId, specs])

  /* Nạp tên Specialization của mọi Major để hiển thị nhãn tiến trình cho dễ đọc */
  useEffect(() => {
    if (majors.length === 0) return
    Promise.all(
      majors.map(m => getSpecializationsByMajor(m.id).catch(() => []))
    ).then(results => {
      results.flatMap(toArray).forEach(s => specNameRef.current.set(s.id, s.name))
    })
  }, [majors])

  // ───────────────────────── Dữ liệu đề xuất ─────────────────────────
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const [pendingData, acceptedData] = await Promise.all([
        getTrendingWeightProposals('PENDING').catch(() => []),
        getTrendingWeightProposals('ACCEPTED').catch(() => [])
      ])

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

        /* Svol/Sacc/Junior ratio: máy chủ CHỈ trả giá trị của đợt này, không có giá
           trị "hiện tại" để so. Trước đây bảng đọc item.currentSacc/currentSvol/
           currentJunior — những field API chưa từng trả về — nên cột nào cũng hiện
           "0 → X", trông như mọi chỉ số đều đang từ 0 đi lên.

           Sacc và junior ratio là TỶ LỆ 0..1, không phải phần trăm. Code cũ
           Math.round() thẳng rồi gắn dấu %, nên junior ratio 0.42 hiện thành "0%"
           và Sacc chỉ khác 0 khi tăng trưởng vượt 50%. */
        const svol = Number(item.svolNew ?? 0)
        const saccPct = Number(item.saccNew ?? 0) * 100
        const juniorPct = Number(item.juniorRatioNew ?? 0) * 100

        /* Giá trị đang áp dụng, để so với giá trị đợt này.

           Giữ null NGUYÊN VẸN, tuyệt đối không `?? 0`: null nghĩa là CNH chưa từng có
           đề xuất nào được duyệt (hoặc đề xuất tạo trước khi backend lưu ba cột này),
           còn 0 là kết quả đo thật — Svol 0 nghĩa là không có tin tuyển dụng nào. Gộp
           hai thứ đó lại chính là lỗi "0 → X" mà màn này đã từng mắc. */
        const svolOld = item.svolOld != null ? Number(item.svolOld) : null
        const saccOldPct = item.saccOld != null ? Number(item.saccOld) * 100 : null
        const juniorOldPct = item.juniorRatioOld != null ? Number(item.juniorRatioOld) * 100 : null

        const batchStartedAt = item.crawlBatchStartedAt ? new Date(item.crawlBatchStartedAt).getTime() : null
        const createdAtMs = item.createdAt ? new Date(item.createdAt).getTime() : Date.now()

        return {
          id: item.id || Math.random().toString(),
          narrowSpecId: nsId,
          specId: item.specId || item.specializationId || nsInfo.specId || '',
          majorId: item.majorId || nsInfo.majorId || '',
          narrowSpecCode: code,
          narrowSpecName: name,
          version: item.version || 1,
          ns: displayName,
          specKey: item.id || Math.random().toString(),
          /* Danh tính đợt lấy thẳng từ máy chủ, không còn suy đoán theo đồng hồ. */
          crawlBatchId: item.crawlBatchId || null,
          batchStartedAt,
          batchScopeName: item.crawlBatchScopeName || '',
          batchTriggeredBy: item.crawlBatchTriggeredBy || '',
          /* null CHỨ KHÔNG PHẢI 0 khi chưa có TW cũ: 0 là điểm đo được thật
             (CNH không có tin tuyển dụng nào), còn null là "chưa từng duyệt đề xuất
             nào cho CNH này". Gộp lại thì mọi CNH mới đều trông như đi lên từ 0. */
          twCurrent: item.twOld != null ? Math.round(Number(item.twOld)) : null,
          twProposed: item.twNew != null ? Math.round(Number(item.twNew)) : 0,
          /* twOld và twNew do HAI công thức khác nhau sinh ra -> hai thang đo khác
             nhau, không được đặt cạnh nhau. Xảy ra đúng ở lượt đầu sau khi đổi công
             thức chuẩn hoá; duyệt xong thì current_tw sang thang mới và cờ này tắt. */
          scaleChanged: item.twFormulaVersion != null
            && item.twOldFormulaVersion != null
            && item.twFormulaVersion !== item.twOldFormulaVersion,
          svol,
          saccPct,
          juniorPct,
          svolOld,
          saccOldPct,
          juniorOldPct,
          profile: item.profile || null,
          profileLabel: item.profileLabel || '',
          rawDate: createdAtMs,
          approvedAt: item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString('vi-VN') : 'Mới duyệt',
          approvedBy: item.reviewedBy || username,
          createdBy: item.crawlBatchTriggeredBy || item.reviewedBy || username,
          note: item.note || ''
        }
      }

      const pending = toArray(pendingData).map(mapItem).filter(Boolean)
      const accepted = toArray(acceptedData).map(mapItem).filter(Boolean).sort((a, b) => b.rawDate - a.rawDate)
      if (!aliveRef.current) return
      setProposals(pending)
      setHistoryList(accepted)
    } catch (err) {
      console.error('Failed to load proposals:', err)
    } finally {
      if (aliveRef.current && !silent) setLoading(false)
    }
  }, [username])

  // ───────────────────────── Pipeline: Cào ➔ Chuẩn hóa ➔ Tính tỷ số ─────────────────────────
  const upsertJob = useCallback((batchId, patch) => {
    if (!aliveRef.current) return
    setJobs(prev => {
      const idx = prev.findIndex(j => j.batchId === batchId)
      if (idx === -1) return [...prev, { batchId, phase: 'CRAWL', ...patch }]
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }, [])

  /* Bọc polling để có thể hủy khi unmount */
  const waitCrawl = useCallback((batchId, onUpdate) => new Promise((resolve, reject) => {
    const stop = pollCrawlBatch(batchId, (batch) => {
      if (onUpdate) onUpdate(batch)
      if (batch?.status === 'TIMEOUT') {
        pollStopsRef.current.delete(stop)
        reject(new Error('Quá thời gian thu thập dữ liệu'))
      } else if (batch && CRAWL_TERMINAL_STATUSES.includes(batch.status)) {
        pollStopsRef.current.delete(stop)
        resolve(batch)
      }
    })
    pollStopsRef.current.add(stop)
  }), [])

  const waitNormalize = useCallback((batchId, onUpdate) => new Promise((resolve, reject) => {
    const stop = pollNormalizeStatus(batchId, (statusData) => {
      if (onUpdate) onUpdate(statusData)
      if (statusData?.status === 'TIMEOUT') {
        pollStopsRef.current.delete(stop)
        reject(new Error('Quá thời gian chờ chuẩn hóa'))
      } else if (statusData && statusData.pending === 0) {
        pollStopsRef.current.delete(stop)
        resolve(statusData)
      }
    })
    pollStopsRef.current.add(stop)
  }), [])

  /* Chờ backend tính xong Trending Weight — nhận biết qua stage của batch. */
  const waitCalculate = useCallback((batchId, onUpdate) => new Promise((resolve, reject) => {
    const stop = pollBatchStage(batchId, (batch) => {
      if (onUpdate) onUpdate(batch)
      if (batch?.stage === 'TIMEOUT') {
        pollStopsRef.current.delete(stop)
        reject(new Error('Quá thời gian chờ tính Trending Weight'))
      } else if (batch?.stage === 'DONE' || batch?.stage === 'FAILED') {
        pollStopsRef.current.delete(stop)
        resolve(batch)
      }
    })
    pollStopsRef.current.add(stop)
  }), [])

  /**
   * Theo dõi trọn vòng đời 1 batch. Backend tự nối chuỗi cào ➔ chuẩn hóa ➔ tính
   * Trending Weight (CrawlPipelineListener), nên FE CHỈ QUAN SÁT, không tự gọi
   * /normalize hay /trending-weight/calculate nữa — gọi thêm sẽ chạy chồng một
   * phiên normalize thứ hai và tạo ra proposal TW trùng lặp (thêm version mới cho
   * mọi NS, kể cả NS ngoài phạm vi batch).
   */
  const runBatchPipeline = useCallback(async (batchId, label, options = {}) => {
    const { skipCrawl = false, initialPhase = null } = options
    upsertJob(batchId, {
      label,
      phase: initialPhase || (skipCrawl ? 'NORMALIZE' : 'CRAWL'),
      error: null
    })

    try {
      if (!skipCrawl) {
        const finished = await waitCrawl(batchId, batch => upsertJob(batchId, {
          batch,
          // Trong lúc batch còn RUNNING thì tin theo stage của backend; khi đã chốt
          // trạng thái thì để luồng dưới tự chuyển bước, tránh nháy "Hoàn tất".
          ...(batch?.status === 'RUNNING' && STAGE_TO_PHASE[batch.stage]
            ? { phase: STAGE_TO_PHASE[batch.stage] }
            : {})
        }))
        if (finished?.status === 'FAILED') {
          upsertJob(batchId, { phase: 'FAILED', error: 'Thu thập dữ liệu thất bại' })
          showToast(`Thu thập dữ liệu thất bại: ${label}`)
          return
        }
        // Bị dừng thì DỪNG CẢ CHUỖI. Backend cũng không bắn sự kiện nối tiếp khi
        // batch CANCELLED, nên đi tiếp xuống bước chuẩn hóa ở đây sẽ chờ vô ích
        // tới lúc hết thời gian rồi báo lỗi sai bản chất.
        if (finished?.status === 'CANCELLED') {
          upsertJob(batchId, { phase: 'CANCELLED', error: null })
          showToast(`Đã dừng thu thập dữ liệu: ${label}`)
          return
        }
      }

      // Bước 2 — chuẩn hóa (backend đã tự khởi động ngay sau khi cào xong)
      upsertJob(batchId, { phase: 'NORMALIZE' })
      await waitNormalize(batchId, normalize => upsertJob(batchId, { normalize }))

      // Bước 3 — tính Trending Weight, cũng do backend tự chạy
      upsertJob(batchId, { phase: 'CALCULATE' })
      const calculated = await waitCalculate(batchId, batch => upsertJob(batchId, { batch }))
      if (calculated?.stage === 'FAILED') {
        upsertJob(batchId, { phase: 'FAILED', error: 'Tính Trending Weight thất bại' })
        showToast(`Tính Trending Weight thất bại: ${label}`)
        return
      }

      upsertJob(batchId, { phase: 'DONE' })
      showToast(`Đã tính xong trọng số mới: ${label}`)

      // Hiện dần kết quả — nạp lại nhưng không làm trắng bảng
      await loadData({ silent: true })
    } catch (err) {
      console.error('Pipeline error for batch', batchId, err)
      upsertJob(batchId, { phase: 'FAILED', error: err.message || 'Lỗi không xác định' })
    }
  }, [upsertJob, waitCrawl, waitNormalize, waitCalculate, loadData, showToast])

  const batchLabel = useCallback((batch) => {
    const specName = batch?.scopeSpecializationId ? specNameRef.current.get(batch.scopeSpecializationId) : null
    return specName || batch?.batchCode || `Batch ${String(batch?.id || '').slice(0, 8)}`
  }, [])

  // ───────────────────────── Dò phiên đang chạy khi mở trang ─────────────────────────
  const detectRunningCrawler = useCallback(async () => {
    setCheckingCrawler(true)
    let resumed = false
    try {
      // /batches/active giờ trả về mọi batch có stage ∈ {CRAWLING, NORMALIZING,
      // CALCULATING}, tức là đã bao trọn cả 3 bước đang chạy dở. Không còn phải tự
      // dò backlog PENDING ở client nữa — cách dò cũ đếm PENDING theo Specialization
      // (không theo batch) nên chỉ cần sót lại vài tracking rác từ đợt crawl cũ là
      // trang lúc nào cũng bật spinner "đang chạy" dù thực tế không có gì chạy.
      const activeBatches = toArray(await getActiveCrawlBatches().catch(() => []))
      if (activeBatches.length === 0) return

      resumed = true
      setIsCrawling(true)
      setRunningScope('RESUME')
      setCheckingCrawler(false)
      showToast(`Phát hiện ${activeBatches.length} phiên đang chạy — đang theo dõi tiếp...`)

      await Promise.allSettled(
        activeBatches.map(b => runBatchPipeline(b.id, batchLabel(b), {
          // Vào lại đúng bước batch đang dở, không mặc định coi là đã cào xong.
          skipCrawl: b.stage !== 'CRAWLING',
          initialPhase: STAGE_TO_PHASE[b.stage]
        }))
      )
    } catch (err) {
      console.error('Failed to detect active crawler:', err)
    } finally {
      if (aliveRef.current) {
        setCheckingCrawler(false)
        if (resumed) {
          setIsCrawling(false)
          setRunningScope(null)
        }
      }
    }
  }, [runBatchPipeline, batchLabel, showToast])

  useEffect(() => {
    loadData()
    detectRunningCrawler()
  }, [loadData, detectRunningCrawler])

  // ───────────────────────── Hành động crawler ─────────────────────────
  const isBusy = isCrawling || checkingCrawler

  const handleRunAllCrawler = async () => {
    if (isBusy) return
    setIsCrawling(true)
    setRunningScope('ALL')
    setJobs([])
    try {
      showToast('Đang kích hoạt thu thập dữ liệu cho tất cả các ngành...')
      const runResult = await runCrawlAll()

      const started = []
      if (runResult && Array.isArray(runResult.results)) {
        runResult.results.forEach(r => {
          if (r.success && r.batch?.id) {
            started.push({
              id: r.batch.id,
              label: specNameRef.current.get(r.specializationId) || r.specializationCode || batchLabel(r.batch)
            })
          } else if (!r.success && r.errorMessage) {
            console.warn(`Không thể thu thập ${r.specializationCode}: ${r.errorMessage}`)
          }
        })
      }

      if (started.length === 0) {
        showToast('Không có chuyên ngành nào được đưa vào hàng đợi.')
        return
      }

      showToast(`Đã đưa ${started.length} chuyên ngành vào hàng đợi.`)
      await Promise.allSettled(started.map(b => runBatchPipeline(b.id, b.label)))
      showToast('Đã hoàn tất ')
    } catch (err) {
      console.error('Failed to run crawler for all:', err)
      showToast('Lỗi khi chạy crawler tất cả ngành: ' + (err.response?.data?.message || err.message))
    } finally {
      if (aliveRef.current) {
        setIsCrawling(false)
        setRunningScope(null)
      }
    }
  }

  const handleRunSelectedSpecCrawler = async () => {
    if (isBusy) return

    const targetSpecIds = selectedSpecIds.length > 0
      ? selectedSpecIds
      : availableSpecs.map(s => s.id)

    if (targetSpecIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 Chuyên ngành để thu thập dữ liệu!')
      return
    }

    setIsCrawling(true)
    setRunningScope('SPEC')
    setJobs([])

    try {
      showToast(`Đang kích hoạt thu thập dữ liệu cho ${targetSpecIds.length} chuyên ngành...`)

      const started = []
      await Promise.allSettled(
        targetSpecIds.map(async (specId) => {
          try {
            const createdBatch = await runCrawl(specId)
            const batchId = createdBatch?.id
            if (batchId) {
              const label = specNameRef.current.get(specId) || 'Chuyên ngành'
              started.push({ id: batchId, label })
            }
          } catch (err) {
            console.error(`Không thể kích hoạt thu thập cho chuyên ngành ${specId}:`, err)
          }
        })
      )

      if (started.length === 0) {
        showToast('Không có phiên thu thập nào được khởi tạo thành công.')
        return
      }

      showToast(`Đã đưa ${started.length} chuyên ngành vào hàng đợi.`)
      await Promise.allSettled(started.map(b => runBatchPipeline(b.id, b.label)))
      showToast('Đã hoàn tất thu thập, chuẩn hóa và tính trọng số cho các chuyên ngành!')
    } catch (err) {
      console.error('Failed to run crawler for selected specs:', err)
      showToast('Lỗi khi chạy crawler chuyên ngành: ' + (err.response?.data?.message || err.message))
    } finally {
      if (aliveRef.current) {
        setIsCrawling(false)
        setRunningScope(null)
      }
    }
  }

  // ───────────────────────── Lọc & phân trang ─────────────────────────
  const batchGroups = useMemo(() => getBatchGroups(proposals), [proposals])

  const filteredProposals = useMemo(() => {
    const activeBatchObj = selectedBatchId === 'ALL'
      ? null
      : batchGroups.find(b => b.id === selectedBatchId)

    return proposals.filter(p => {
      if (activeBatchObj && !activeBatchObj.items.some(i => i.id === p.id)) {
        return false
      }
      if (majorId && p.majorId && p.majorId !== majorId) return false
      if (selectedSpecIds.length > 0 && p.specId && !selectedSpecIds.includes(p.specId)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchCode = (p.narrowSpecCode || '').toLowerCase().includes(q)
        const matchNs = (p.ns || '').toLowerCase().includes(q)
        /* p.batchCode chưa từng tồn tại — API không trả field đó, nên nhánh này luôn
           false. Tìm theo tên Chuyên ngành của đợt cào thì mới thật sự dùng được. */
        const matchBatch = (p.batchScopeName || '').toLowerCase().includes(q)
        if (!matchCode && !matchNs && !matchBatch) return false
      }
      return true
    })
  }, [proposals, batchGroups, selectedBatchId, majorId, selectedSpecIds, searchQuery])

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setCurrentPage(1)
  }, [majorId, selectedSpecIds, searchQuery, selectedBatchId])

  const totalPages = Math.max(1, Math.ceil(filteredProposals.length / pageSize))
  const paginatedProposals = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProposals.slice(start, start + pageSize)
  }, [filteredProposals, currentPage, pageSize])

  // ───────────────────────── Duyệt / từ chối / rollback ─────────────────────────
  const decide = async (specKey, action) => {
    const p = proposals.find(item => item.specKey === specKey)
    if (!p) return

    /* Máy chủ là nơi quyết định. Trước đây hai lời gọi này bị `.catch(() => {})`
       nuốt lỗi, rồi code vẫn xoá dòng khỏi bảng và báo "Đã duyệt" — nên khi máy chủ
       từ chối (đề xuất không còn PENDING, mất mạng, 500) người dùng vẫn thấy thành
       công, bấm Làm mới thì nó hiện lại. Hỏng thì báo hỏng và GIỮ NGUYÊN dòng. */
    if (p.id && !p.id.startsWith('mock-')) {
      try {
        if (action === 'APPROVED') {
          await approveTrendingWeightProposal(p.id)
        } else if (action === 'REJECTED') {
          await rejectTrendingWeightProposal(p.id)
        }
      } catch (err) {
        console.error('Decision failed for proposal', p.id, err)
        const serverMsg = err.response?.data?.message
        showToast(serverMsg || `Không ${action === 'APPROVED' ? 'duyệt' : 'từ chối'} được ${p.ns} — vui lòng thử lại`)
        return
      }
    }

    if (action === 'APPROVED') {
      const approvedItem = { ...p, rawDate: Date.now(), approvedAt: 'Mới duyệt', approvedBy: username }
      setHistoryList(prev => [approvedItem, ...prev.filter(h => h.id !== p.id)])
      setProposals(prev => prev.filter(item => item.specKey !== specKey))
      showToast(`Đã duyệt trọng số cho CNH ${p.ns}`)
    } else {
      setDecided(prev => ({ ...prev, [specKey]: action }))
      setProposals(prev => prev.filter(item => item.specKey !== specKey))
      showToast(`Đã từ chối đề xuất ${p.ns}`)
    }
  }

  const handleRollback = async (historyItem) => {
    try {
      if (historyItem.narrowSpecId && historyItem.id && !historyItem.id.startsWith('mock-')) {
        const targetVer = historyItem.version && historyItem.version > 1 ? historyItem.version - 1 : 1
        await rollbackTrendingWeight({ narrowSpecId: historyItem.narrowSpecId, targetVersion: targetVer }).catch(() => { })
      }
    } catch (err) {
      console.warn('Backend rollback notice:', err)
    }
    setHistoryList(prev => prev.filter(h => h.id !== historyItem.id))
    setProposals(prev => [historyItem, ...prev])
    showToast(`Đã hoàn tác duyệt trọng số của CNH ${historyItem.ns}`)
  }

  /**
   * Duyệt / từ chối hàng loạt bằng MỘT request.
   *
   * Trước đây hàm này chạy vòng lặp `await` gọi endpoint đơn lẻ cho từng đề xuất —
   * một đợt hơn trăm CNH là hơn trăm request tuần tự, và nếu người dùng đóng tab
   * giữa chừng thì một nửa đã duyệt, một nửa còn chờ.
   *
   * Chỉ gửi ID đang HIỂN THỊ theo bộ lọc, nên nhãn nút và hộp xác nhận phải nói rõ
   * đang xử lý bao nhiêu trên tổng bao nhiêu — "tất cả" khi đang lọc không phải là
   * tất cả.
   */
  const decideAll = async (action) => {
    const isApprove = action === 'APPROVED'
    const targets = filteredProposals.filter(
      p => !decided[p.specKey] && p.id && !p.id.startsWith('mock-')
    )
    if (targets.length === 0) return

    const scopeNote = targets.length < proposals.length
      ? ` (đang lọc — còn ${proposals.length - targets.length} đề xuất khác không nằm trong danh sách này)`
      : ''
    const verb = isApprove ? 'DUYỆT' : 'TỪ CHỐI'
    if (!window.confirm(`Bạn có chắc chắn muốn ${verb} ${targets.length} đề xuất đang hiển thị?${scopeNote}`)) return

    setLoading(true)
    try {
      const ids = targets.map(p => p.id)
      const res = isApprove
        ? await bulkApproveTrendingWeightProposals(ids)
        : await bulkRejectTrendingWeightProposals(ids)

      /* Máy chủ trả 200 kèm số dòng hỏng — 200 KHÔNG có nghĩa là mọi dòng đều xong. */
      const succeeded = res?.succeeded ?? 0
      const failed = res?.failed ?? 0
      const doneWord = isApprove ? 'duyệt' : 'từ chối'

      if (failed === 0) {
        showToast(`Đã ${doneWord} ${succeeded} đề xuất`)
      } else {
        const firstErr = res?.results?.find(r => !r.success)?.errorMessage
        showToast(`Đã ${doneWord} ${succeeded}, thất bại ${failed}${firstErr ? ` — ${firstErr}` : ''}`)
      }
    } catch (err) {
      console.error('Bulk decision failed:', err)
      showToast(err.response?.data?.message || `Không gửi được yêu cầu ${isApprove ? 'duyệt' : 'từ chối'} hàng loạt`)
    } finally {
      await loadData()
    }
  }

  const approveAll = () => decideAll('APPROVED')
  const rejectAll = () => decideAll('REJECTED')

  const clearFilters = () => {
    setMajorId('')
    setSelectedSpecIds([])
    setSearchQuery('')
    setSelectedBatchId('ALL')
  }

  const hasFilter = Boolean(majorId || selectedSpecIds.length > 0 || searchQuery.trim() || selectedBatchId !== 'ALL')
  const doneJobs = jobs.filter(j => j.phase === 'DONE').length
  const failedJobs = jobs.filter(j => j.phase === 'FAILED').length
  const cancelledJobs = jobs.filter(j => j.phase === 'CANCELLED').length
  /* canCancel do may chu tinh (chu phien hoac Admin) - FE chi dem lai, khong tu
     suy luan quyen. 0 nghia la khong co phien nao bam duoc, an han nut. */
  const cancellableCount = jobs.filter(j => j.batch?.canCancel === true).length

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <Layout
      role="cm"
      user={{ name: username }}
      onLogout={handleLogout}
      onLogoClick={() => navigate('/')}
      onGoHome={() => navigate('/')}
    >
      <div className="tw-page">
        {/* ── 1. Tiêu đề + Nút Lịch sử ── */}
        <header className="cm-page-head">
          <div className="cm-page-head-main">
            <span className="cm-page-head-icon"><TrendingUp size={19} strokeWidth={2.2} /></span>
            <div>
              <h1 className="cm-page-title">Đề xuất trọng số thị trường</h1>
              <p className="cm-page-sub">
                Tính toán trọng số hot theo cấp Chuyên ngành hẹp dựa trên dữ liệu job market
              </p>
            </div>
          </div>
          <div className="cm-page-head-actions">
            <button
              type="button"
              className="tw-btn tw-btn--ghost"
              onClick={() => navigate('/cm/trending-weight/history')}
              title="Xem lịch sử các đề xuất trọng số đã được duyệt"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <History size={14} /> Lịch sử đã duyệt
            </button>
          </div>
        </header>

        {/* ── 2. Trạng thái crawler ── */}
        {checkingCrawler && !isCrawling && (
          <div className="tw-banner tw-banner--checking">
            <div className="tw-banner-head">
              <div className="tw-banner-left">
                <div className="tw-banner-icon">
                  <Search size={17} />
                </div>
                <div>
                  <div className="tw-banner-title">Đang kiểm tra trạng thái crawler...</div>
                  <div className="tw-banner-sub">
                    Tạm khóa
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isCrawling && (
          <div className="tw-banner">
            <div className="tw-banner-head">
              <div className="tw-banner-left">
                <div className="tw-banner-icon">
                  <Loader2 size={18} className="tw-spin" />
                </div>
                <div>
                  <div className="tw-banner-title">
                    <span>
                      {runningScope === 'RESUME'
                        ? 'Hệ thống đang chạy một phiên thu thập dữ liệu'
                        : runningScope === 'SPEC'
                          ? 'Đang xử lý chuyên ngành đã chọn'
                          : 'Đang xử lý toàn bộ chuyên ngành'}
                    </span>
                    <span className="tw-chip">
                      {doneJobs}/{jobs.length || 1} hoàn tất
                      {failedJobs > 0 ? ` · ${failedJobs} lỗi` : ''}
                      {cancelledJobs > 0 ? ` · ${cancelledJobs} đã dừng` : ''}
                    </span>
                  </div>

                </div>
              </div>
              <div className="tw-banner-hint">
                {/* Nhan bam theo SO PHIEN THUC SU DUNG DUOC, khong ghi cung
                    "Dung tat ca": may chu chi cho Content Manager dung phien cua
                    chinh minh, nen khi con phien cua nguoi khac thi "tat ca" la
                    noi doi - bam xong van con phien chay tiep. */}
                {cancellableCount > 0 && (
                  <button
                    type="button"
                    className="tw-banner-stop-all"
                    onClick={handleCancelAll}
                    disabled={cancellingAll}
                    title={cancellableCount === jobs.length
                      ? 'Dừng toàn bộ phiên đang chạy'
                      : `Bạn chỉ dừng được ${cancellableCount}/${jobs.length} phiên — số còn lại do người khác chạy`}
                  >
                    <XCircle size={13} />
                    {cancellingAll
                      ? 'Đang gửi…'
                      : cancellableCount === jobs.length
                        ? 'Dừng tất cả'
                        : `Dừng ${cancellableCount} phiên của bạn`}
                  </button>
                )}
                <RefreshCw size={13} className="tw-spin-slow" /> Tự động làm mới
              </div>
            </div>

            {jobs.length > 0 && (
              <CrawlJobList
                jobs={jobs}
                onCancel={handleCancelJob}
                cancellingIds={cancellingIds}
              />
            )}
          </div>
        )}

        {/* ── 3. Thanh công cụ ── */}
        <div className="tw-toolbar">
          <div className="tw-toolbar-filters">
            {/* Lọc theo đợt */}
            <div className="tw-field">
              <label className="tw-field-label" htmlFor="tw-batch">Lọc theo đợt</label>
              <select
                id="tw-batch"
                className="tw-select"
                value={selectedBatchId}
                onChange={e => {
                  setSelectedBatchId(e.target.value)
                  setCurrentPage(1)
                }}
              >
                {/* "Tất cả" đứng đầu vì đó là mặc định — danh sách chờ duyệt đầy đủ,
                    không giấu đợt nào. Các đợt bên dưới để soi riêng từng phiên cào. */}
                <option value="ALL">Tất cả đang chờ duyệt ({proposals.length} CNH)</option>
                {batchGroups.map(bg => (
                  <option key={bg.id} value={bg.id}>{bg.label}</option>
                ))}
              </select>
            </div>

            {/* Ngành (Major) */}
            <div className="tw-field">
              <label className="tw-field-label" htmlFor="tw-major">Ngành (Major)</label>
              <select
                id="tw-major"
                className="tw-select"
                value={majorId}
                onChange={e => {
                  setMajorId(e.target.value)
                  setSelectedSpecIds([])
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
              title="Bỏ toàn bộ điều kiện lọc, xem lại tất cả dữ liệu đã thu thập"
            >
              <FilterX size={14} /> Xóa lọc
            </button>
          </div>

          <div className="tw-toolbar-actions">
            {/* Nút thu thập CN đã chọn - XÁM khi chưa chọn chuyên ngành nào */}
            <button
              type="button"
              className="tw-btn tw-btn--secondary"
              onClick={handleRunSelectedSpecCrawler}
              disabled={isBusy || selectedSpecIds.length === 0}
              style={{ alignSelf: 'flex-end', height: '36px' }}
              title={
                isBusy
                  ? 'Hệ thống đang chạy một phiên thu thập — vui lòng đợi'
                  : selectedSpecIds.length === 0
                    ? 'Vui lòng chọn ít nhất 1 chuyên ngành ở mục Chuyên ngành (Đa chọn)'
                    : `Thu thập dữ liệu cho ${selectedSpecIds.length} chuyên ngành đang chọn`
              }
            >
              {isCrawling && runningScope === 'SPEC'
                ? <><Loader2 size={14} className="tw-spin" /> Đang chạy...</>
                : <><Play size={14} /> {selectedSpecIds.length > 0 ? `Thu thập ${selectedSpecIds.length} CN` : 'Thu thập CN đã chọn'}</>}
            </button>

            <div className="tw-toolbar-divider" />

            <button
              type="button"
              className="tw-btn tw-btn--primary"
              onClick={handleRunAllCrawler}
              disabled={isBusy}
              style={{ alignSelf: 'flex-end', height: '36px' }}
              title={isBusy ? 'Hệ thống đang chạy một phiên thu thập — vui lòng đợi' : 'Thu thập dữ liệu cho toàn bộ chuyên ngành đã cấu hình'}
            >
              {checkingCrawler
                ? <><Loader2 size={14} className="tw-spin" /> Đang kiểm tra...</>
                : isCrawling
                  ? <><Loader2 size={14} className="tw-spin" /> Hệ thống đang thu thập...</>
                  : <><Database size={14} /> Thu thập tất cả ngành</>}
            </button>
          </div>
        </div>

        {/* ── 4. Nội dung: Danh sách đề xuất chờ duyệt ── */}
        <div className="tw-card" style={{ width: '100%' }}>
          <div className="tw-card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
              {/* Hiện cả tổng khi đang lọc: con số duy nhất trên tiêu đề từng khiến
                  người dùng tưởng đã xem hết, trong khi bộ lọc đang giấu phần còn lại. */}
              <span className="tw-card-title">
                Đề xuất chờ duyệt ({filteredProposals.length}
                {filteredProposals.length !== proposals.length ? `/${proposals.length}` : ''})
              </span>

              {/* Ô tìm kiếm CNH đặt cạnh tiêu đề Đề xuất chờ duyệt */}
              <div className="tw-search-wrap" style={{ width: '260px' }}>
                <Search size={14} className="tw-search-icon" />
                <input
                  id="tw-search"
                  type="text"
                  className="tw-search-input"
                  placeholder="Tìm theo mã hoặc tên CNH..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="tw-search-clear"
                    onClick={() => {
                      setSearchQuery('')
                      setCurrentPage(1)
                    }}
                    title="Xóa tìm kiếm"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Nút Làm mới đặt góc phải trên cùng của Panel */}
              <button
                type="button"
                className="tw-btn tw-btn--ghost tw-btn--sm"
                onClick={() => loadData()}
                disabled={loading}
                title="Nạp lại danh sách đề xuất"
                style={{ height: '32px', padding: '0 10px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={loading ? 'tw-spin' : undefined} /> Làm mới
              </button>

              {/* Nhãn nói đúng phạm vi thật: nút chỉ xử lý những đề xuất ĐANG HIỂN
                  THỊ theo bộ lọc. Ghi trống không "Duyệt tất cả" trong khi đang lọc
                  là hứa nhiều hơn việc nó làm. */}
              {filteredProposals.length > 0 && (
                <div className="tw-bulk-actions">
                  <button
                    className="tw-btn-outline"
                    onClick={rejectAll}
                    disabled={loading}
                    type="button"
                    title={`Từ chối ${filteredProposals.length} đề xuất đang hiển thị`}
                  >
                    Từ chối {filteredProposals.length === proposals.length ? 'tất cả' : `${filteredProposals.length} mục đang lọc`}
                  </button>
                  <button
                    className="tw-btn-solid"
                    onClick={approveAll}
                    disabled={loading}
                    type="button"
                    title={`Duyệt ${filteredProposals.length} đề xuất đang hiển thị`}
                  >
                    Duyệt {filteredProposals.length === proposals.length ? 'tất cả' : `${filteredProposals.length} mục đang lọc`}
                  </button>
                </div>
              )}
            </div>
          </div>

          <table className="tw-table">
            <thead>
              <tr>
                <th>Narrow Specialization</th>
                <th>TW hiện tại → mới</th>
                <th>Sacc cũ → mới</th>
                <th>Svol cũ → mới (số tin)</th>
                <th>Junior ratio cũ → mới</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="tw-empty">Đang tải danh sách đề xuất...</td>
                </tr>
              ) : paginatedProposals.length > 0 ? (
                paginatedProposals.map((p) => {
                  const twDelta = delta(p.twCurrent, p.twProposed)
                  const status = decided[p.specKey]
                  return (
                    <tr key={p.specKey}>
                      <td>
                        <div className="tw-ns-name">{p.ns}</div>
                        {/* Với SPARSE, Sacc bị ép 0 nên "tăng trưởng 0.0%" là con số
                            bịa — hiện nhãn hồ sơ thay vì để CM tưởng đã đo được. */}
                        <div className="tw-ns-sub">
                          {p.svol} tin tuyển dụng
                          {p.profile === 'SPARSE'
                            ? ` · ${p.profileLabel || 'Chưa đủ dữ liệu'}`
                            : ` · tăng trưởng ${fmtPct(p.saccPct)}`}
                        </div>
                      </td>
                      <td>
                        {p.scaleChanged ? (
                          <>
                            <span className="tw-tw-values">{p.twProposed}</span>
                            <span className="tw-delta tw-flat" title="TW cũ được tính bằng công thức chuẩn hoá khác (min-max theo đợt) nên không so sánh được với giá trị mới. Duyệt đề xuất này xong thì các đợt sau lại so được bình thường.">đổi thang đo</span>
                          </>
                        ) : (
                          <>
                            <span className="tw-tw-values">{p.twCurrent == null ? '—' : p.twCurrent} → {p.twProposed}</span>
                            {/* Không vẽ delta khi thiếu đầu "cũ" — chữ "—" ở giá trị đã
                                nói đủ. KHÔNG ẩn theo SPARSE nữa: vấn đề lệch thang đo
                                do scaleChanged xử lý rồi, mà với SPARSE thì TW bằng
                                đúng Svol chuẩn hoá nên delta vẫn là số thật. */}
                            {p.twCurrent != null
                              && <span className={`tw-delta ${twDelta.cls}`}>{twDelta.sign}{twDelta.d}</span>}
                          </>
                        )}
                      </td>
                      {/* "cũ → mới" cho từng thành phần. Giá trị cũ lấy từ svolOld /
                          saccOld / juniorRatioOld — ảnh chụp lúc tạo đề xuất.
                          "—" nghĩa là chưa từng có đề xuất nào được duyệt cho CNH này,
                          KHÁC với 0 (đo được nhưng bằng không). */}
                      {/* Với SPARSE, Sacc và Junior bị ép 0 rồi nhân trọng số 0 nên
                          không ảnh hưởng TW. Vẫn hiện số 0 như mọi dòng khác — đó đúng
                          là giá trị đang lưu; phần "chưa đo được" đã nói ở phụ đề
                          "Chưa đủ dữ liệu" dưới tên CNH. */}
                      <td className="tw-component">
                        <span className="tw-comp-cur">{p.saccOldPct == null ? '—' : fmtPct(p.saccOldPct)}</span> → {fmtPct(p.saccPct)}
                      </td>
                      <td className="tw-component">
                        <span className="tw-comp-cur">{p.svolOld == null ? '—' : p.svolOld}</span> → {p.svol}
                      </td>
                      <td className="tw-component">
                        <span className="tw-comp-cur">{p.juniorOldPct == null ? '—' : `${p.juniorOldPct.toFixed(1)}%`}</span> → {Number(p.juniorPct || 0).toFixed(1)}%
                      </td>
                      <td>
                        {status ? (
                          <span className={`tw-decision-badge tw-decision-badge--${status.toLowerCase()}`}>
                            {status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
                          </span>
                        ) : (
                          <div className="tw-decision-actions">
                            <button className="tw-btn-outline-sm" onClick={() => decide(p.specKey, 'REJECTED')} type="button">Từ chối</button>
                            <button className="tw-btn-solid-sm" onClick={() => decide(p.specKey, 'APPROVED')} type="button">Duyệt</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="tw-empty">
                    {isCrawling
                      ? 'Chưa có đề xuất nào — kết quả sẽ hiện dần khi từng chuyên ngành tính xong.'
                      : hasFilter
                        ? 'Không có đề xuất trọng số nào khớp với bộ lọc đã chọn.'
                        : 'Không có đề xuất trọng số nào đang chờ duyệt.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filteredProposals.length > 0 && (
            <CmPagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredProposals.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={[5, 10, 20, 50]}
              itemLabel="đề xuất"
            />
          )}
        </div>
      </div>

      {toast && <div className="tw-toast">{toast}</div>}
    </Layout>
  )
}
