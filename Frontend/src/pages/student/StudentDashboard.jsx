import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Sparkles,
  Route as RouteIcon,
  Trophy,
  Brain,
  CheckCircle2,
  Clock,
  Circle,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  Star,
} from 'lucide-react'
import { logout } from '../../services/authService'
import { getMyRoadmaps, getRoadmapDetail } from '../../services/roadmapService'
import {
  getStudentProfile,
  getDeclaredSkills,
  getDeclaredInterests,
  getMyGrades,
  getStudentSkillSuggestions
} from '../../services/studentService'
import {
  getLatestRecommendation,
  getRecommendationHistory,
  getRecommendationResultById
} from '../../services/recommendationService'
import Layout from '../../components/layout/Layout'
import './StudentDashboard.css'

/* ── Mock data ──────────────────────────────── */
const MOCK = {
  name: 'Nguyễn Văn A',
  major: 'Công nghệ thông tin',
  narrowSpec: 'Chưa chọn chuyên ngành hẹp',
  term: 1,
  gpa: 0,
  profileScore: 0,
  updatedAt: 'Hôm nay',
  skills: { count: 0, newCount: 0 },
  interests: { count: 0 },
  roadmap: { done: 0, studying: 0, total: 0, credits: 0, totalCredits: 0 },
  holland: {
    scores: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
    dims: [
      { label: 'R', val: 0 },
      { label: 'I', val: 0 },
      { label: 'A', val: 0 },
      { label: 'S', val: 0 },
      { label: 'E', val: 0 },
      { label: 'C', val: 0 },
    ],
    top: [
      { dim: 'Chưa làm đánh giá', val: 0, primary: true },
    ],
  },
  recommendations: [],
  twUpdatedAt: 'Chưa cập nhật',
  donutBreakdown: [0, 0, 0, 100],
}

/* ── Animated counter ───────────────────────────────────────── */
function useAnimCount(target, decimals = 0, duration = 900) {
  const [val, setVal] = useState(0)
  const animate = useCallback(() => {
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(parseFloat((target * ease).toFixed(decimals)))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, decimals, duration])
  return [val, animate]
}

/* ── Scroll reveal hook ──────────────────────────────────────── */
function useReveal(ref) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return visible
}

/* ── Chart components ────────────────────────────────────────── */
function customDonutTooltip(context) {
  const { chart, tooltip } = context;
  let tooltipEl = chart.canvas.parentNode.querySelector('div.sd-donut-custom-tooltip');

  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'sd-donut-custom-tooltip';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.background = '#0F172A';
    tooltipEl.style.color = '#FFFFFF';
    tooltipEl.style.borderRadius = '8px';
    tooltipEl.style.padding = '6px 12px';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.fontWeight = '600';
    tooltipEl.style.fontFamily = "'Be Vietnam Pro', sans-serif";
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.whiteSpace = 'nowrap';
    tooltipEl.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)';
    tooltipEl.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    tooltipEl.style.zIndex = '99999';
    tooltipEl.style.transition = 'opacity 0.12s ease';
    tooltipEl.style.transform = 'translate(-50%, -120%)';
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = '0';
    return;
  }

  if (tooltip.body) {
    const dataIndex = tooltip.dataPoints[0]?.dataIndex;
    const label = chart.data.labels[dataIndex] || '';
    const value = tooltip.dataPoints[0]?.raw || 0;
    const color = tooltip.labelColors[0]?.backgroundColor || '#F37021';

    tooltipEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; display: inline-block; flex-shrink: 0;"></span>
        <span>${label}: <strong>${value}%</strong></span>
      </div>
    `;
  }

  const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
  tooltipEl.style.opacity = '1';
  tooltipEl.style.left = positionX + tooltip.caretX + 'px';
  tooltipEl.style.top = positionY + tooltip.caretY + 'px';
}

function DonutChart({ breakdown }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !window.Chart) return
    const c = new window.Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: ['Thông tin cá nhân', 'Bảng điểm', 'Kỹ năng', 'Sở thích', 'Chưa hoàn thiện'],
        datasets: [{
          data: breakdown,
          backgroundColor: ['#034EA2', '#8B5CF6', '#F37021', '#51B848', 'rgba(255,255,255,0.12)'],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: false,
        cutout: '70%',
        animation: false, // Bỏ hiệu ứng xoay khi mới vào trang
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false, // Tắt tooltip vẽ trong Canvas 88px bị giới hạn
            external: customDonutTooltip // Dùng Tooltip HTML DOM mở rộng không bị che cụt
          }
        },
      },
    })
    return () => c.destroy()
  }, [breakdown])
  return (
    <canvas ref={ref} width={88} height={88} role="img" aria-label="Hoàn thiện hồ sơ" />
  )
}



const formatMultilinedLabel = (name) => {
  if (!name) return ''
  if (name.length > 16) {
    return name.slice(0, 14) + '...'
  }
  return name
}

function RankingChart({ data }) {
  const ref = useRef(null)
  // Backend chỉ trả finalScore — không tự chia 70/30 thành 2 thành phần không tồn tại (DEF_100)
  const finals = data.map((d) => d.finalScore ?? 0)
  const bgColors = data.map((_, i) => (i === 0 ? '#F37021' : i === 1 ? '#034EA2' : '#85B7EB'))
  useEffect(() => {
    if (!ref.current || !window.Chart) return
    const c = new window.Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map((d) => formatMultilinedLabel(d.name)),
        datasets: [
          {
            label: 'Điểm tương thích',
            data: data.map((d) => d.finalScore ?? 0),
            backgroundColor: bgColors,
            borderRadius: 0,
            borderSkipped: false,
            stack: 's',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => `${c.dataset.label}: ${Math.round(c.raw)}`,
              afterBody: (items) => {
                const idx = items[0].dataIndex
                const itemData = data[idx]
                const tiedText = itemData?.isTied ? ' (Đồng hạng)' : ''
                return [`Hạng ${itemData?.rank ?? '-'} · Điểm tương thích: ${finals[idx]}${tiedText}`]
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 12, family: 'Be Vietnam Pro', weight: '600' }, maxRotation: 0 },
            grid: { display: false },
            stacked: true,
          },
          y: {
            min: 0, max: 100,
            ticks: { font: { size: 11, family: 'Be Vietnam Pro' }, stepSize: 25 },
            grid: { color: 'rgba(0,0,0,0.04)' },
            stacked: true,
          },
        },
      },
    })
    return () => c.destroy()
  }, [data])
  return (
    <div className="sd-chart-wrap" style={{ minHeight: 240 }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={`Ranking: ${data.map((d) => `${d.name} ${d.finalScore ?? 0}`).join(', ')}`}
      >
        {data.map((d) => `${d.name}: ${d.finalScore ?? 0}`).join(', ')}
      </canvas>
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  const navigate = useNavigate()
  const username = localStorage.getItem('username') || 'Sinh viên'

  const [studentProfile, setStudentProfile] = useState(null)
  const [declaredSkillsCount, setDeclaredSkillsCount] = useState(0)
  const [declaredInterestsCount, setDeclaredInterestsCount] = useState(0)
  const [declaredInterestsList, setDeclaredInterestsList] = useState([])
  const [suggestedSkills, setSuggestedSkills] = useState([])
  const [transcriptGrades, setTranscriptGrades] = useState([])
  const [myRoadmapsList, setMyRoadmapsList] = useState([])
  const [selectedRoadmapId, setSelectedRoadmapId] = useState('')
  const [roadmapDetail, setRoadmapDetail] = useState(null)
  const [roadmapMode, setRoadmapMode] = useState('transcript') // 'transcript' | 'personal'
  const [recommendationsData, setRecommendationsData] = useState([])
  const [recHistoryList, setRecHistoryList] = useState([])
  const [selectedRecResultId, setSelectedRecResultId] = useState('')
  // Mốc thời gian thật của lần chạy gợi ý đang xem, thay cho chuỗi cứng "Hôm nay" (DEF_100)
  const [recCalculatedAt, setRecCalculatedAt] = useState(null)

  const formatHistoryDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  // Load history list
  useEffect(() => {
    getRecommendationHistory()
      .then(list => {
        setRecHistoryList(list || [])
        if (list && list.length > 0 && !selectedRecResultId) {
          setSelectedRecResultId(list[0].id)
        }
      })
      .catch(err => console.error("Failed to load recommendation history:", err))
  }, [])

  // Load recommendation chart data for selected result ID
  useEffect(() => {
    const fetchRec = async () => {
      try {
        const recData = selectedRecResultId
          ? await getRecommendationResultById(selectedRecResultId)
          : await getLatestRecommendation()

        if (recData && recData.items && recData.items.length > 0) {
          // Đồng hạng theo rank thật của server, không theo điểm đã làm tròn
          const rankCounts = {}
          recData.items.forEach(it => {
            if (it.rank == null) return
            rankCounts[it.rank] = (rankCounts[it.rank] || 0) + 1
          })

          const formatted = recData.items.map(it => ({
            name: it.narrowSpecName || it.narrowSpecCode,
            finalScore: Math.round(it.finalScore || 0),
            rank: it.rank,
            isTied: it.rank != null && rankCounts[it.rank] > 1
          }))
          setRecommendationsData(formatted)
          setRecCalculatedAt(recData.calculatedAt || null)
        } else {
          setRecommendationsData([])
          setRecCalculatedAt(null)
        }
      } catch (err) {
        console.error("Failed to load recommendations for chart:", err)
        setRecommendationsData([])
        setRecCalculatedAt(null)
      }
    }
    fetchRec()
  }, [selectedRecResultId])

  // Load all backend data
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const profile = await getStudentProfile()
        setStudentProfile(profile)
      } catch (err) {
        console.error("Failed to load student profile:", err)
      }

      try {
        const skills = await getDeclaredSkills()
        const sArr = Array.isArray(skills) ? skills : (skills?.skills || skills?.items || [])
        setDeclaredSkillsCount(sArr.length)
      } catch (err) {
        console.error("Failed to load skills:", err)
      }

      try {
        const interests = await getDeclaredInterests()
        const iArr = Array.isArray(interests) ? interests : (interests?.interests || interests?.items || [])
        setDeclaredInterestsCount(iArr.length)
        setDeclaredInterestsList(iArr.map(i => typeof i === 'string' ? i : (i.label || i.name)))
      } catch (err) {
        console.error("Failed to load interests:", err)
      }

      try {
        const sugData = await getStudentSkillSuggestions()
        const sugArr = Array.isArray(sugData) ? sugData : (sugData?.suggestions || sugData?.items || sugData?.skills || [])
        if (sugArr.length > 0) {
          setSuggestedSkills(sugArr.map(s => {
            if (typeof s === 'string') return { name: s, reason: 'Gợi ý từ bảng điểm' }
            const name = s.name || s.skillName || s.label
            const reason = s.suggestedReason || (s.sourceCourseNames?.length > 0 ? `Do bạn đã hoàn thành môn: ${s.sourceCourseNames.join(', ')}` : 'Gợi ý từ môn học đã qua')
            return { name, reason }
          }))
        } else {
          setSuggestedSkills(['Python', 'Data Analytics', 'SQL', 'React', 'Problem Solving'].map(name => ({ name, reason: 'Gợi ý phổ biến' })))
        }
      } catch {
        setSuggestedSkills(['Python', 'Data Analytics', 'SQL', 'React', 'Problem Solving'].map(name => ({ name, reason: 'Gợi ý phổ biến' })))
      }

      try {
        const grades = await getMyGrades()
        const gArr = Array.isArray(grades) ? grades : (grades?.grades || grades?.items || grades?.data || [])
        setTranscriptGrades(gArr)
      } catch (err) {
        console.error("Failed to load grades:", err)
      }

      try {
        const list = await getMyRoadmaps()
        const rList = list || []
        setMyRoadmapsList(rList)
        if (rList.length > 0) {
          setSelectedRoadmapId(rList[0].id)
        }
      } catch (err) {
        console.error("Failed to load my roadmaps:", err)
      }
    }

    loadAllData()
  }, [])

  // Load roadmap detail when selected
  useEffect(() => {
    if (!selectedRoadmapId) return
    getRoadmapDetail(selectedRoadmapId)
      .then(detail => setRoadmapDetail(detail))
      .catch(err => {
        console.error("Failed to load roadmap detail:", err)
        // 404 = lộ trình đã bị xoá ở server -> gỡ khỏi danh sách và quay về chế độ bảng điểm (DEF_106)
        if (err.response?.status === 404) {
          setRoadmapDetail(null)
          setMyRoadmapsList(prev => prev.filter(r => r.id !== selectedRoadmapId))
          setSelectedRoadmapId('')
          setRoadmapMode('transcript')
        } else {
          setRoadmapDetail(null)
        }
      })
  }, [selectedRoadmapId])

  // Calculate transcript stats
  const transcriptStats = React.useMemo(() => {
    const defaultTermMap = {}
    for (let t = 1; t <= 9; t++) {
      defaultTermMap[t] = t < (studentProfile?.currentTerm || 1) ? 'done' : t === (studentProfile?.currentTerm || 1) ? 'cur' : 'todo'
    }

    const gArr = Array.isArray(transcriptGrades) ? transcriptGrades : (transcriptGrades?.grades || transcriptGrades?.items || transcriptGrades?.data || [])

    if (gArr.length === 0) {
      // Chưa có bảng điểm nhưng hồ sơ đã cache cumulativeGpa thì dùng số đó, không hiện 0.00 (DEF_104)
      // Lưới kỳ để trống hoàn toàn khi chưa có tiến độ nào (DEF_103)
      const cachedGpa = studentProfile?.cumulativeGpa != null ? Number(studentProfile.cumulativeGpa) : 0
      return { gpa: cachedGpa, done: 0, studying: 0, total: 0, credits: 0, totalCredits: null, termMap: {}, hasData: false }
    }

    const isPassedStatus = (st) => st === 'PASSED' || st === 'Passed' || st === 'COMPLETED' || st === 'Completed'
    const isStudyingStatus = (st) => st === 'IN_PROGRESS' || st === 'In_Progress' || st === 'STUDYING' || st === 'Studying' || st === 'ENROLLED'

    const passed = gArr.filter(g => isPassedStatus(g?.status) || (g?.grade != null && g?.grade >= 5.0) || g?.isPassed)
    const studying = gArr.filter(g => isStudyingStatus(g?.status))
    const passedCredits = passed.reduce((sum, g) => sum + (g?.credit ?? g?.credits ?? 3), 0)
    const totalCreditsInTranscript = gArr.reduce((sum, g) => sum + (g?.credit ?? g?.credits ?? 3), 0)

    const cachedGpa = studentProfile?.cumulativeGpa != null ? Number(studentProfile.cumulativeGpa) : null
    let totalScoreWeighted = 0
    let totalCreditCount = 0
    gArr.forEach(g => {
      // BR-31: môn có countsTowardGpa = false không được gộp vào phép tính GPA (DEF_104)
      if (g && g.countsTowardGpa === false) return
      if (g && g.grade != null && g.grade >= 0) {
        const isPassed = isPassedStatus(g?.status) || g.grade >= 5.0 || g?.isPassed
        if (isPassed) {
          const cr = g.credit ?? g.credits ?? 3
          totalScoreWeighted += g.grade * cr
          totalCreditCount += cr
        }
      }
    })
    const gpa = cachedGpa != null ? cachedGpa : (totalCreditCount > 0 ? (totalScoreWeighted / totalCreditCount) : 0)

    const termMap = {}
    for (let t = 1; t <= 9; t++) {
      const termGrades = gArr.filter(g => g && (g.termNo === t || g.term === t))
      if (termGrades.length === 0) {
        termMap[t] = defaultTermMap[t]
      } else {
        const hasPassed = termGrades.some(g => isPassedStatus(g.status) || (g.grade != null && g.grade >= 5.0))
        const hasStudying = termGrades.some(g => isStudyingStatus(g.status))
        if (hasStudying) termMap[t] = 'cur'
        else if (hasPassed) termMap[t] = 'done'
        else termMap[t] = 'todo'
      }
    }

    // Mẫu số là tổng tín chỉ thật của bảng điểm, không gán cứng 120 (DEF_104)
    const totalCredits = totalCreditsInTranscript || null

    return {
      gpa,
      done: passed.length,
      studying: studying.length,
      total: gArr.length,
      credits: passedCredits,
      totalCredits,
      termMap,
      hasData: true
    }
  }, [transcriptGrades, studentProfile])

  // Calculate personal roadmap stats
  const personalRoadmapStats = React.useMemo(() => {
    if (!roadmapDetail) {
      return { done: 0, studying: 0, total: 0, credits: 0, totalCredits: null, nsName: '', termMap: {}, hasData: false }
    }
    const terms = roadmapDetail.terms || roadmapDetail.termGroups || []
    const flatCourses = []
    const termMap = {}

    terms.forEach(tg => {
      if (!tg) return
      const tNo = tg.termNo || tg.termIndex || 1
      let tHasStudying = false
      let tHasDone = false

      const courses = tg.courses || tg.items || []
      courses.forEach(c => {
        if (!c) return
        let status = 'todo'
        if (c.progressStatus === 'IN_PROGRESS' || c.status === 'IN_PROGRESS') {
          status = 'studying'
          tHasStudying = true
        } else if (c.progressStatus === 'COMPLETED' || c.status === 'COMPLETED' || c.status === 'PASSED') {
          status = 'done'
          tHasDone = true
        }
        flatCourses.push({ credits: c.credits ?? c.credit ?? 3, status })
      })

      if (tHasStudying) termMap[tNo] = 'cur'
      else if (tHasDone) termMap[tNo] = 'done'
      else termMap[tNo] = 'todo'
    })

    // Kỳ không có môn nào trong lộ trình thì để trống, không tô theo currentTerm (DEF_103)
    for (let t = 1; t <= 9; t++) {
      if (!termMap[t]) termMap[t] = 'todo'
    }

    const done = flatCourses.filter(c => c.status === 'done').length
    const studying = flatCourses.filter(c => c.status === 'studying').length
    const credits = flatCourses.filter(c => c.status === 'done').reduce((s, c) => s + (c.credits || 0), 0)
    const totalCredits = flatCourses.reduce((s, c) => s + (c.credits || 0), 0) || null
    return {
      done,
      studying,
      total: flatCourses.length,
      credits,
      totalCredits,
      nsName: roadmapDetail.narrowSpecName || roadmapDetail.name || '',
      termMap,
      hasData: flatCourses.length > 0
    }
  }, [roadmapDetail])

  // Active roadmap data depending on mode
  const activeRoadmapStats = roadmapMode === 'personal' && personalRoadmapStats.total > 0
    ? personalRoadmapStats
    : transcriptStats

  // Favorite/Bookmarked courses for the selected personal roadmap ONLY
  const activeFavoriteCourses = React.useMemo(() => {
    if (roadmapMode !== 'personal' || !roadmapDetail || !roadmapDetail.terms) {
      return []
    }
    const bookmarked = []
    roadmapDetail.terms.forEach(tg => {
      (tg.courses || []).forEach(c => {
        if (c.bookmarked || c.isBookmarked) {
          bookmarked.push({
            id: c.courseId || c.id,
            code: c.code,
            name: c.name || c.courseName || '',
            credits: c.credits ?? c.credit ?? 3,
            term: tg.termOrder ?? tg.termNo ?? 1,
            status: c.progressStatus || c.status,
            bookmarked: true
          })
        }
      })
    })
    return bookmarked
  }, [roadmapMode, roadmapDetail])

  // Combined Dashboard Profile Data
  const p = React.useMemo(() => {
    const name = studentProfile?.fullName || username
    const major = studentProfile?.majorName || 'Chưa chọn ngành'
    const narrowSpec = (roadmapMode === 'personal' && personalRoadmapStats.nsName)
      ? personalRoadmapStats.nsName
      : (studentProfile?.currentNarrowSpecName || studentProfile?.specializationName || 'Chưa chọn chuyên ngành hẹp')
    const term = studentProfile?.currentTerm ?? null
    const gpa = transcriptStats.gpa || 0

    // Profile score calculation:
    // - Thông tin cá nhân: 25%
    // - Bảng điểm: 25%
    // - Skill: 25% (nếu < 5 kỹ năng là 20%, 0 kỹ năng là 0%)
    // - Interest: 25% (nếu < 5 sở thích là 20%, 0 sở thích là 0%)
    const hasInfo = (studentProfile?.fullName && studentProfile?.majorId && studentProfile?.specializationId) ? 25 : 0
    const gArr = Array.isArray(transcriptGrades) ? transcriptGrades : (transcriptGrades?.grades || transcriptGrades?.items || [])
    const hasTranscript = gArr.length > 0 ? 25 : 0
    const hasSkills = declaredSkillsCount >= 5 ? 25 : (declaredSkillsCount > 0 ? 20 : 0)
    const hasInterests = declaredInterestsCount >= 5 ? 25 : (declaredInterestsCount > 0 ? 20 : 0)
    const profileScore = hasInfo + hasTranscript + hasSkills + hasInterests

    const donutBreakdown = [
      hasInfo,
      hasTranscript,
      hasSkills,
      hasInterests,
      Math.max(0, 100 - profileScore)
    ]

    return {
      name,
      major,
      narrowSpec,
      term,
      gpa,
      profileScore,
      updatedAt: formatHistoryDate(studentProfile?.profileUpdatedAt) || 'Chưa có',
      skills: { count: declaredSkillsCount || 0, newCount: 0 },
      interests: { count: declaredInterestsCount || 0 },
      roadmap: activeRoadmapStats || { done: 0, studying: 0, total: 0, credits: 0, totalCredits: 120, termMap: {} },
      holland: MOCK.holland || { scores: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }, dims: [], top: [] },
      recommendations: recommendationsData,
      twUpdatedAt: formatHistoryDate(recCalculatedAt) || 'chưa có dữ liệu',
      donutBreakdown,
    }
  }, [studentProfile, username, transcriptStats, declaredSkillsCount, declaredInterestsCount, transcriptGrades, roadmapMode, personalRoadmapStats, activeRoadmapStats, recommendationsData, recCalculatedAt])

  /* Refs */
  const heroRef = useRef(null)
  const profileRef = useRef(null)
  const hollandRef = useRef(null)
  const rankingRef = useRef(null)

  const heroVisible = useReveal(heroRef)
  const profileVisible = useReveal(profileRef)
  const hollandVisible = useReveal(hollandRef)
  const rankingVisible = useReveal(rankingRef)



  /* Progress bar — width calculated smoothly based on course count */
  const progWidth = React.useMemo(() => {
    const denominator = p.roadmap.total;
    if (!denominator) return '0%';
    const numerator = p.roadmap.done || 0;
    const pct = Math.min(100, Math.round((numerator / denominator) * 100));
    return `${pct}%`;
  }, [p.roadmap.done, p.roadmap.total])

  /* Holland dim bars — chạy khi hollandRef visible */
  const [hollandBarsReady, setHollandBarsReady] = useState(false)
  useEffect(() => {
    if (hollandVisible) setTimeout(() => setHollandBarsReady(true), 200)
  }, [hollandVisible])

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <Layout
      role="student"
      user={{ name: username }}
      onLogout={handleLogout}
      onLogoClick={() => navigate('/')}
      onGoHome={() => navigate('/')}
    >
      <div className="sd-page">

        {/* ── HERO ──────────────────────────────────────── */}
        <div className="sd-hero">
          <div className="sd-hero-left">
            <div>
              <div className="sd-hero-title-row">
                <span className="sd-hero-icon-badge">
                  <GraduationCap size={22} strokeWidth={2.5} />
                </span>
                {/* Lời chào dùng họ tên trong hồ sơ, chỉ fallback username khi hồ sơ chưa có tên (DEF_101) */}
                <h1>Xin chào, {p.name}!</h1>
              </div>
              <p className="sd-hero-meta">
                Chuyên ngành: <strong>{p.major}</strong>
                <br />

                Chuyên ngành hẹp: <span className="sd-spec-hl">{p.narrowSpec}</span>
                <br />
                Cập nhật lần cuối: {p.updatedAt}&nbsp;·&nbsp;{p.term ? `Kỳ ${p.term} / 9` : 'Chưa khai báo kỳ học'}
              </p>
            </div>
          </div>

          <div className="sd-hero-right">
            <div className="sd-hbox">
              {/* DC-01 yêu cầu 3 chữ số thập phân cho GPA (DEF_104) */}
              <div className="sd-hval">{(p.gpa || 0).toFixed(3)}</div>
              <div className="sd-hlbl">GPA hiện tại</div>
              <div className="sd-hsub">/ 10</div>
            </div>
            <div className="sd-hbox sd-hbox-profile">
              <div className="sd-hlbl" style={{ marginBottom: 6 }}>Hồ sơ</div>
              <div className="sd-donut-wrap">
                <DonutChart breakdown={p.donutBreakdown} />
              </div>
              {p.profileScore < 100 ? (
                <div className="sd-hero-alert-badge" title="Hồ sơ chưa hoàn thiện, hãy cập nhật để nhận gợi ý chính xác hơn!">
                  ⚠️ Chưa hoàn thiện ({p.profileScore}%)
                </div>
              ) : (
                <div className="sd-hero-success-badge">
                  ✅ Đã hoàn thiện
                </div>
              )}
              <button
                className="sd-btn-orange"
                style={{ marginTop: 8, padding: '7px 12px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/student/profile')}
              >
                Cập nhật hồ sơ
                <ArrowRight className="sd-btn-icon" />
              </button>
            </div>
          </div>
        </div>

        {/* ── PROFILE & ROADMAP ─────────────────────────── */}
        <div
          ref={profileRef}
          className={`sd-reveal${profileVisible ? ' sd-visible' : ''}`}
          style={{ transitionDelay: '80ms' }}
        >
          <div className="sd-sec-title">
            <span className="sd-sec-icon-wrap"><RouteIcon /></span>
            Lộ trình học tập &amp; Môn học ưa thích
          </div>

          <div className="sd-roadmap-full-card">
            {/* Left side: Biểu đồ & tiến độ lộ trình cá nhân */}
            <div className="sd-roadmap-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="sd-ctitle-row" style={{ marginBottom: 0 }}>
                  <RouteIcon className="sd-ctitle-icon" />
                  <div className="sd-ctitle" style={{ marginBottom: 0 }}>Tiến độ — {p.narrowSpec}</div>
                </div>
                <select
                  className="sd-roadmap-select"
                  value={roadmapMode === 'transcript' ? 'transcript' : selectedRoadmapId}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'transcript') {
                      setRoadmapMode('transcript')
                    } else {
                      setRoadmapMode('personal')
                      setSelectedRoadmapId(val)
                    }
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: '1px solid #B5D4F4',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#034EA2',
                    background: '#EAF2FB',
                    cursor: 'pointer'
                  }}
                >
                  <option value="transcript">Theo Bảng điểm</option>
                  {myRoadmapsList.map((rm) => {
                    const label = rm.name || rm.narrowSpecName || `Lộ trình ${rm.id}`
                    const date = new Date(rm.updatedAt || rm.createdAt || new Date()).toLocaleDateString('vi-VN')
                    return (
                      <option key={rm.id} value={rm.id}>
                        {`${label} (Cập nhật ${date})`}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="sd-prog-label">
                <span>Tổng tiến độ</span>
                <span>
                  {p.roadmap.total
                    ? `${p.roadmap.done} / ${p.roadmap.total} môn`
                    : 'Chưa có dữ liệu môn học'}
                </span>
              </div>
              <div className="sd-prog-track">
                <div className="sd-prog-fill" style={{ width: progWidth, transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </div>

              <div className="sd-status-grid">
                <div className="sd-sc sd-sc-done">
                  <CheckCircle2 className="sd-sc-icon" />
                  <div className="sd-sc-num">{p.roadmap.done}</div>
                  <div className="sd-sc-sub">Đã qua</div>
                </div>
                <div className="sd-sc sd-sc-cur">
                  <Clock className="sd-sc-icon" />
                  <div className="sd-sc-num">{p.roadmap.studying}</div>
                  <div className="sd-sc-sub">Đang học</div>
                </div>
                <div className="sd-sc sd-sc-todo">
                  <Circle className="sd-sc-icon" />
                  <div className="sd-sc-num">{Math.max(0, p.roadmap.total - p.roadmap.done - p.roadmap.studying)}</div>
                  <div className="sd-sc-sub">Chưa học</div>
                </div>
              </div>

              <div className="sd-term-lbl">Tiến độ theo kỳ</div>
              <div className="sd-term-grid">
                {Array.from({ length: 9 }, (_, i) => {
                  const termNo = i + 1
                  // Chưa có tiến độ nào thì để trống lưới, không tô màu theo currentTerm (DEF_103)
                  const state = p.roadmap.hasData ? (p.roadmap.termMap?.[termNo] || 'todo') : 'empty'
                  return (
                    <div key={termNo} className={`sd-term-cell sd-term-${state}`} title={`Kỳ ${termNo}`}>
                      K{termNo}
                    </div>
                  )
                })}
              </div>

              <div className="sd-term-legend">
                <div className="sd-tleg"><div className="sd-tdot" style={{ background: '#51B848' }} />Đã xong</div>
                <div className="sd-tleg"><div className="sd-tdot" style={{ background: '#F37021' }} />Đang học</div>
                <div className="sd-tleg"><div className="sd-tdot" style={{ background: '#f0f2f7', border: '0.5px solid #d1d5db' }} />Chưa học</div>
              </div>

              <button
                className="sd-btn-fill-navy"
                style={{ marginTop: 22 }}
                onClick={() => {
                  if (roadmapMode === 'transcript') {
                    navigate('/student/profile/transcript')
                  } else {
                    navigate('/student/personal-roadmap')
                  }
                }}
              >
                {roadmapMode === 'transcript' ? 'Cập nhật bảng điểm' : (p.roadmap.hasData ? 'Cập nhật lộ trình' : 'Tạo lộ trình cá nhân')}
                <ArrowRight className="sd-btn-icon" />
              </button>
            </div>

            {/* Right side: Môn học ưa thích (Bookmarked) theo roadmap */}
            <div className="sd-roadmap-right">
              <div className="sd-fav-header">
                <div className="sd-fav-title-row">
                  <Star className="sd-fav-title-icon" />
                  <span className="sd-fav-title">Môn học ưa thích theo lộ trình</span>
                </div>
                <span className="sd-fav-sub">
                  {roadmapMode === 'personal'
                    ? (p.narrowSpec ? `Chuyên ngành hẹp: ${p.narrowSpec}` : 'Lộ trình cá nhân')
                    : 'Môn học ưa thích chỉ có trong Lộ trình cá nhân — bạn đang xem chế độ Bảng điểm'}
                </span>
              </div>

              <div className="sd-fav-list">
                {roadmapMode !== 'personal' ? (
                  <div className="sd-fav-empty">
                    <Star style={{ width: 28, height: 28, color: '#CBD5E1', marginBottom: 8 }} />
                    <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Vui lòng chọn một Lộ trình cá nhân</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                      Chọn một lộ trình cá nhân từ menu góc trên bên trái để xem các môn học bạn đã đánh dấu ⭐ yêu thích.
                    </p>
                    {myRoadmapsList.length > 0 && (
                      <button
                        className="sd-btn-outline"
                        style={{ fontSize: 12, padding: '6px 14px', marginTop: 12 }}
                        onClick={() => {
                          setRoadmapMode('personal')
                          if (myRoadmapsList[0]?.id) setSelectedRoadmapId(myRoadmapsList[0].id)
                        }}
                      >
                        Xem Lộ trình: {myRoadmapsList[0]?.name || myRoadmapsList[0]?.narrowSpecName || 'Lộ trình 1'}
                      </button>
                    )}
                  </div>
                ) : activeFavoriteCourses.length > 0 ? (
                  activeFavoriteCourses.map((c, idx) => {
                    const isDone = c.status === 'COMPLETED' || c.status === 'PASSED' || c.status === 'done'
                    const isStudying = c.status === 'IN_PROGRESS' || c.status === 'studying'
                    const statusBg = isDone ? '#EAF7EB' : isStudying ? '#FFF4EC' : '#F3F4F6'
                    const statusFg = isDone ? '#27500A' : isStudying ? '#C2410C' : '#4B5563'
                    const statusText = isDone ? 'Đã qua' : isStudying ? 'Đang học' : 'Kế hoạch'

                    return (
                      <div
                        key={c.id || idx}
                        className="sd-fav-card"
                        style={{ cursor: 'pointer' }}
                        title={`Nhấn để chuyển sang Lộ trình cá nhân và xem chi tiết môn ${c.code}`}
                        onClick={() => navigate(`/student/personal-roadmap?roadmapId=${selectedRoadmapId}&courseCode=${c.code}`, {
                          state: { roadmapId: selectedRoadmapId, courseCode: c.code }
                        })}
                      >
                        <div className="sd-fav-card-left">
                          <div className="sd-fav-star-box" title="Môn học ưa thích đã được gắn thẻ ⭐">
                            <Star className="sd-fav-star-icon active" />
                          </div>
                          <div>
                            <div className="sd-fav-cname">{c.name || c.code}</div>
                            <div className="sd-fav-cmeta">
                              <span className="sd-fav-ccode">{c.code}</span>
                              &nbsp;·&nbsp;
                              <span>Kỳ {c.term}</span>
                              &nbsp;·&nbsp;
                              <span>{c.credits} tín chỉ</span>
                            </div>
                          </div>
                        </div>
                        <span className="sd-fav-status-pill" style={{ background: statusBg, color: statusFg }}>
                          {statusText}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="sd-fav-empty">
                    <Star style={{ width: 28, height: 28, color: '#CBD5E1', marginBottom: 8 }} />
                    <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Chưa có môn học yêu thích nào</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                      Bạn chưa đánh dấu ⭐ môn học nào trong lộ trình này. Hãy vào trang Lộ trình cá nhân và nhấn biểu tượng ⭐ để lưu môn học.
                    </p>
                    <button
                      className="sd-btn-outline"
                      style={{ fontSize: 12, padding: '6px 14px', marginTop: 12 }}
                      onClick={() => navigate('/student/personal-roadmap')}
                    >
                      Đánh dấu môn học ngay
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ── RANKING ───────────────────────────────────── */}
        <div
          ref={rankingRef}
          className={`sd-reveal${rankingVisible ? ' sd-visible' : ''}`}
          style={{ transitionDelay: '100ms' }}
        >
          <div className="sd-sec-title">
            <span className="sd-sec-icon-wrap"><Trophy /></span>
            Ranking chuyên ngành hẹp
          </div>
          <div className="sd-rank-card">
            <div className="sd-r-header">
              <div className="sd-r-title">
                Xếp hạng chuyên ngành hẹp phù hợp
              </div>
              <div className="sd-r-actions">
                {recHistoryList.length > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '8px' }}>
                    <label htmlFor="sd-rec-history-select" style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Lịch sử phân tích:</label>
                    <select
                      id="sd-rec-history-select"
                      value={selectedRecResultId}
                      onChange={(e) => setSelectedRecResultId(e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: '600', color: '#034EA2', outline: 'none', cursor: 'pointer' }}
                    >
                      {recHistoryList.map((h, idx) => (
                        <option key={h.id} value={h.id}>
                          {idx === 0 ? `Mới nhất (${formatHistoryDate(h.calculatedAt)})` : `Ngày ${formatHistoryDate(h.calculatedAt)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sd-tw-badge">
                  <span className="sd-live-dot" />
                  cập nhật {p.twUpdatedAt}
                </div>
                {/* Nút chỉ điều hướng sang SCR-18 chứ không tự chạy lại thuật toán — nhãn phải nói đúng (DEF_105) */}
                <button className="sd-btn-refresh" onClick={() => navigate('/student/recommendation?check=true')}>
                  <RefreshCw className="sd-btn-icon" />
                  Kiểm tra hồ sơ &amp; gợi ý lại
                </button>
              </div>
            </div>
            <RankingChart data={p.recommendations} />
          </div>
        </div>

      </div>
    </Layout>
  )
}
