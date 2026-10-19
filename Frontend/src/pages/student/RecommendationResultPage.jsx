import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Trophy, RefreshCw, Target, Heart, GraduationCap, TrendingUp, Sparkles, Award, BookOpen, Info, Medal, History, AlertTriangle, CheckCircle2, ArrowRightLeft, FileText, UserCog } from "lucide-react";
import Layout from "../../components/layout/Layout";
import { logout } from "../../services/authService";
import {
    getLatestRecommendation,
    getRecommendationItemDetail,
    runRecommendation,
    getRecommendationHistory,
    getRecommendationResultById,
    getRecommendationItemDetailByResult
} from "../../services/recommendationService";
import {
    getStudentProfile,
    getDeclaredSkills,
    getDeclaredInterests,
    getMyGrades,
    getLatestTranscript
} from "../../services/studentService";
import RecommendGateModal from "../../components/student/RecommendGateModal";
import "./RecommendationResultPage.css";

// Mỗi tiêu chí kèm tông pastel (nền chip %) và tông đậm (chữ) để đọc nhanh theo màu.
const CRITERIA = [
    { key: "skill", label: "Kỹ năng", color: "#51B848", soft: "#EBF8EA", deep: "#2F7A28", icon: Target },
    { key: "interest", label: "Sở thích", color: "#3B82F6", soft: "#E6EEF9", deep: "#1D4ED8", icon: Heart },
    { key: "academic", label: "Kết quả học tập", color: "#F37021", soft: "#FFF0E6", deep: "#C2540F", icon: GraduationCap },
    { key: "market", label: "Trọng số thị trường", color: "#A855F7", soft: "#F5EAFE", deep: "#7E22CE", icon: TrendingUp },
];

// Ngưỡng đọc kết quả: dưới 50% coi như chưa đủ tin cậy để chốt chuyên ngành hẹp.
const SCORE_THRESHOLD = 50;
// Số mục tối thiểu để coi là "đã khai báo đầy đủ" kỹ năng / sở thích.
const MIN_DECLARED = 5;
// Từ kỳ 5 trở đi mới nhắc sinh viên khai báo chuyên ngành hẹp đang theo học;
// trước đó phần lớn chưa chọn nên nhắc sẽ thành nhiễu.
const NS_DECLARE_TERM = 5;

const ACTION_SKILLS = { label: "Khai báo thêm kỹ năng", to: "/student/profile/skills", icon: Target };
const ACTION_INTERESTS = { label: "Khai báo thêm sở thích", to: "/student/profile/interests", icon: Heart };
const ACTION_TRANSCRIPT = { label: "Cập nhật bảng điểm", to: "/student/profile/transcript", icon: FileText };
const ACTION_PROFILE = { label: "Cập nhật chuyên ngành hẹp hiện tại", to: "/student/profile", icon: UserCog };

/**
 * Diễn giải kết quả Top 1 thành một thông điệp tư vấn.
 * Hai nhánh chính:
 *  · Top 1 < 50%  → chưa đủ tin cậy. Nếu thiếu bảng điểm thì chắc chắn do khai báo thiếu;
 *                   nếu đã đủ dữ liệu đầu vào thì gợi ý cân nhắc chuyển ngành.
 *  · Top 1 ≥ 50%  → đối chiếu với chuyên ngành hẹp sinh viên đang theo để khen/khuyên chuyển.
 */
function buildGuidance({ top1, top1s, profile, skillsCount, interestsCount, hasTranscript }) {
    if (!top1) return null;

    const currentNsId = profile?.currentNarrowSpecId || null;
    const currentNsName = profile?.currentNarrowSpecName || "";
    // Đồng hạng Top 1: chỉ cần CNH hiện tại nằm trong nhóm đồng hạng là đã "chọn đúng".
    const matchesTop1 = !!currentNsId && top1s.some((t) => t.id === currentNsId);

    const lackSkills = skillsCount < MIN_DECLARED;
    const lackInterests = interestsCount < MIN_DECLARED;

    if (top1.matchScore < SCORE_THRESHOLD) {
        // Thiếu bảng điểm → điểm học tập bằng 0, con số dưới 50% chưa phản ánh đúng năng lực.
        if (!hasTranscript) {
            const actions = [ACTION_TRANSCRIPT];
            if (lackSkills) actions.push(ACTION_SKILLS);
            if (lackInterests) actions.push(ACTION_INTERESTS);
            return {
                tone: "warn",
                icon: AlertTriangle,
                title: "Hồ sơ chưa đủ dữ liệu để kết luận",
                message: `Gợi ý cao nhất của bạn mới đạt ${top1.matchScore}%, nhưng bạn chưa cập nhật bảng điểm nên tiêu chí kết quả học tập đang được tính là 0. Hãy bổ sung dữ liệu còn thiếu rồi bấm “Gợi ý lại” để có kết quả chính xác hơn.`,
                checklist: [
                    { label: "Bảng điểm", done: false, detail: "Chưa tải lên / nhập bảng điểm" },
                    { label: "Kỹ năng", done: !lackSkills, detail: `Đã khai báo ${skillsCount}/${MIN_DECLARED} mục tối thiểu` },
                    { label: "Sở thích", done: !lackInterests, detail: `Đã khai báo ${interestsCount}/${MIN_DECLARED} mục tối thiểu` },
                ],
                actions,
            };
        }

        // Đã có bảng điểm: hoặc khai báo kỹ năng/sở thích còn mỏng, hoặc thật sự chỉ có bấy nhiêu.
        const stillThin = lackSkills || lackInterests;
        const actions = [];
        if (lackSkills) actions.push(ACTION_SKILLS);
        if (lackInterests) actions.push(ACTION_INTERESTS);
        return {
            tone: "warn",
            icon: AlertTriangle,
            title: "Độ phù hợp còn thấp — bạn nên cân nhắc lại",
            message: stillThin
                ? `Gợi ý cao nhất của bạn mới đạt ${top1.matchScore}%. Bạn mới khai báo ${skillsCount} kỹ năng và ${interestsCount} sở thích: nếu vẫn còn kỹ năng, sở thích chưa liệt kê, hãy bổ sung rồi bấm “Gợi ý lại”. Còn nếu đó thực sự là toàn bộ thế mạnh của bạn thì không có chuyên ngành hẹp nào trong chuyên ngành hiện tại thật sự khớp — bạn nên trao đổi với cố vấn học tập về khả năng chuyển ngành.`
                : `Bạn đã khai báo đầy đủ kỹ năng, sở thích và bảng điểm, nhưng gợi ý cao nhất vẫn chỉ đạt ${top1.matchScore}%. Điều này cho thấy không có chuyên ngành hẹp nào trong chuyên ngành hiện tại thật sự khớp với hồ sơ của bạn — hãy trao đổi với cố vấn học tập về khả năng chuyển sang chuyên ngành khác.`,
            note: matchesTop1
                ? `Gợi ý cao nhất trùng với “${currentNsName}” bạn đang theo học, nhưng mức độ phù hợp còn thấp.`
                : null,
            actions,
        };
    }

    // Top 1 đủ tin cậy → đối chiếu với chuyên ngành hẹp đang theo học.
    if (matchesTop1) {
        return {
            tone: "success",
            icon: CheckCircle2,
            title: "Bạn đang lựa chọn đúng chuyên ngành hẹp",
            message: `“${currentNsName}” — chuyên ngành hẹp bạn đang theo học — cũng chính là gợi ý phù hợp nhất với hồ sơ của bạn (${top1.matchScore}%). Hãy tiếp tục con đường này và tập trung lấp các khoảng trống kỹ năng trong phần chi tiết gợi ý.`,
            actions: [],
        };
    }

    if (currentNsId) {
        return {
            tone: "switch",
            icon: ArrowRightLeft,
            title: "Hãy cân nhắc chuyển sang chuyên ngành hẹp phù hợp hơn",
            message: `Bạn đang theo “${currentNsName}”, nhưng hồ sơ của bạn khớp nhất với “${top1.name}” (${top1.matchScore}%). Hãy xem chi tiết gợi ý và lộ trình học của chuyên ngành hẹp này trước khi quyết định chuyển đổi.`,
            actions: [],
        };
    }

    return null;
}

// Hạng 1/2/3 dùng huy hiệu vàng/bạc/đồng, từ hạng 4 trở đi dùng tông xanh thương hiệu.
const rankMedalClass = (rank) => {
    if (rank === 1) return "rec-card__rank rec-card__rank--gold";
    if (rank === 2) return "rec-card__rank rec-card__rank--silver";
    if (rank === 3) return "rec-card__rank rec-card__rank--bronze";
    return "rec-card__rank";
};

function useReveal(ref) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.05 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [ref, ref.current]);

    useEffect(() => {
        if (ref.current) {
            const timer = setTimeout(() => setVisible(true), 100);
            return () => clearTimeout(timer);
        }
    }, [ref.current]);

    return visible;
}

function MatchRing({ value, size = 84, stroke = 7, color = "#F37021", animate = true }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const targetOffset = c - (value / 100) * c;
    const [offset, setOffset] = useState(animate ? c : targetOffset);
    const [displayVal, setDisplayVal] = useState(animate ? 0 : value);

    useEffect(() => {
        if (!animate) return;

        let start = null;
        const duration = 1200;
        const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setOffset(c - (value * ease / 100) * c);
            setDisplayVal(Math.round(value * ease));
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }, [value, animate, c]);

    return (
        <div className="match-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="#EEF2F8"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className="match-ring__arc"
                />
            </svg>
            <div className="match-ring__center">
                <strong style={{ fontSize: `${size * 0.28}px` }}>{displayVal}<span style={{ fontSize: `${size * 0.14}px`, color: "#94A3B8" }}>%</span></strong>
                <span style={{ fontSize: `${Math.max(size * 0.1, 8.5)}px` }}>Phù hợp</span>
            </div>
        </div>
    );
}

function CompatBars({ breakdown, loadFailed }) {
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Không dựng số giả khi chi tiết tải lỗi — nói thẳng là chưa đọc được (DEF_152)
    if (loadFailed || !breakdown) {
        return (
            <div className="rec-empty" style={{ padding: "12px", fontSize: "12.5px" }}>
                <AlertTriangle size={15} color="#F59E0B" />
                Chưa đọc được điểm chi tiết của chuyên ngành hẹp này. Hãy tải lại trang để xem đầy đủ.
            </div>
        );
    }

    return (
        <div className="compat-bars">
            {CRITERIA.map((crit) => {
                const raw = breakdown[crit.key];
                // null = thiếu dữ liệu (vd chưa crawl trending weight), khác hẳn giá trị 0 thật (DEF_154)
                const missing = raw == null;
                const val = missing ? 0 : raw;
                const IconComponent = crit.icon;
                return (
                    <div
                        className="compat-bar"
                        key={crit.key}
                        style={{ "--bar-soft": crit.soft, "--bar-deep": crit.deep }}
                    >
                        <div className="compat-bar__head">
                            <span className="compat-bar__label" title={crit.label}>
                                {IconComponent && <IconComponent size={14} style={{ color: crit.color, flexShrink: 0 }} />}
                                <span>{crit.label}</span>
                            </span>
                            <span className="compat-bar__value">{missing ? "Chưa có dữ liệu" : `${val}%`}</span>
                        </div>
                        <div className="compat-bar__track">
                            <div
                                className="compat-bar__fill"
                                style={{
                                    width: animated && !missing ? `${val}%` : "0%",
                                    backgroundColor: missing ? "#CBD5E1" : crit.color,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function NarrowSpecMatchResultPage() {
    const navigate = useNavigate();
    const isLoggedIn = !!localStorage.getItem("accessToken");
    const username = localStorage.getItem("username");

    const [recs, setRecs] = useState([]);
    const [isReRunning, setIsReRunning] = useState(false);
    const [gateMessage, setGateMessage] = useState("");
    const [activeTop1Idx, setActiveTop1Idx] = useState(0);
    const [loadError, setLoadError] = useState(null);
    // Chưa từng chạy gợi ý (404) khác hẳn lỗi tải — cần empty-state có CTA (DEF_156)
    const [neverRun, setNeverRun] = useState(false);
    const latestRequestRef = useRef(0);

    const [historyList, setHistoryList] = useState([]);
    const [selectedResultId, setSelectedResultId] = useState("");

    // Dữ liệu hồ sơ dùng để diễn giải kết quả (đủ/thiếu khai báo, CNH đang theo học).
    const [profile, setProfile] = useState(null);
    const [skillsCount, setSkillsCount] = useState(0);
    const [interestsCount, setInterestsCount] = useState(0);
    const [hasTranscript, setHasTranscript] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false);

    const formatHistoryDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    useEffect(() => {
        getRecommendationHistory()
            .then((list) => {
                setHistoryList(list || []);
                if (list && list.length > 0 && !selectedResultId) {
                    setSelectedResultId(list[0].id);
                }
            })
            .catch((err) => console.error("Failed to load recommendation history:", err));
    }, []);

    const loadProfileContext = useCallback(async () => {
        const [profileRes, skillsRes, interestsRes, gradesRes, transcriptRes] = await Promise.allSettled([
            getStudentProfile(),
            getDeclaredSkills(),
            getDeclaredInterests(),
            getMyGrades(),
            getLatestTranscript(),
        ]);

        const toArray = (data) => (Array.isArray(data) ? data : (data?.items || data?.skills || data?.interests || data?.grades || data?.data || []));

        const prof = profileRes.status === "fulfilled" ? profileRes.value : null;
        if (prof) setProfile(prof);
        if (skillsRes.status === "fulfilled") setSkillsCount(toArray(skillsRes.value).length);
        if (interestsRes.status === "fulfilled") setInterestsCount(toArray(interestsRes.value).length);

        const gradeCount = gradesRes.status === "fulfilled" ? toArray(gradesRes.value).length : 0;
        const hasFile = transcriptRes.status === "fulfilled" && !!transcriptRes.value;
        const hasGpa = prof?.cumulativeGpa != null && Number(prof.cumulativeGpa) > 0;
        setHasTranscript(gradeCount > 0 || hasFile || hasGpa);

        setProfileLoaded(true);
    }, []);

    useEffect(() => {
        loadProfileContext().catch((err) => {
            console.error("Failed to load profile context:", err);
            setProfileLoaded(true);
        });
    }, [loadProfileContext]);

    const loadRecommendations = useCallback(async (targetResultId) => {
        // Chỉ response của lần chọn mới nhất được áp dụng — tránh đua dữ liệu khi đổi
        // lịch sử liên tục (DEF_157)
        const requestId = ++latestRequestRef.current;
        const isStale = () => requestId !== latestRequestRef.current;

        setLoadError(null);
        try {
            const data = targetResultId
                ? await getRecommendationResultById(targetResultId)
                : await getLatestRecommendation();
            if (isStale()) return;

            if (!data || !data.items || data.items.length === 0) {
                setRecs([]);
                setNeverRun(true);
                return;
            }

            const detailedItems = await Promise.all(
                data.items.map(async (item) => {
                    const base = {
                        rank: item.rank,
                        id: item.narrowSpecId,
                        code: item.narrowSpecCode,
                        name: item.narrowSpecName,
                        specId: item.specializationId,
                        specName: item.specializationName || "Chuyên ngành",
                        matchScore: Math.round(item.finalScore || 0),
                        rawFinalScore: item.finalScore || 0,
                        fallbackApplied: item.fallbackApplied === true,
                    };
                    try {
                        const detail = targetResultId
                            ? await getRecommendationItemDetailByResult(targetResultId, item.narrowSpecId)
                            : await getRecommendationItemDetail(item.narrowSpecId);
                        return {
                            ...base,
                            specId: detail.specializationId || item.specializationId,
                            specName: detail.specializationName || item.specializationName || "Chuyên ngành",
                            rawProfileScore: detail.profileScore ?? null,
                            alphaActual: detail.alphaActual ?? null,
                            fallbackApplied: detail.fallbackApplied === true || base.fallbackApplied,
                            detailLoadFailed: false,
                            breakdown: {
                                skill: detail.skillScore == null ? null : Math.round(detail.skillScore),
                                interest: detail.interestScore == null ? null : Math.round(detail.interestScore),
                                academic: detail.gpaScore == null ? null : Math.round(detail.gpaScore),
                                // null (chưa crawl) khác 0 (nhu cầu thật bằng 0) — DEF_154
                                market: detail.trendingWeightSnapshot == null ? null : Math.round(detail.trendingWeightSnapshot),
                            },
                        };
                    } catch (err) {
                        console.error("Failed to load recommendation item detail:", item.narrowSpecId, err);
                        // Không bịa breakdown, không ép rawProfileScore = 0 — cả 2 đều làm sai thứ hạng (DEF_152)
                        return {
                            ...base,
                            rawProfileScore: null,
                            alphaActual: null,
                            detailLoadFailed: true,
                            breakdown: null,
                        };
                    }
                })
            );
            if (isStale()) return;
            setRecs(detailedItems);
            setNeverRun(false);
        } catch (err) {
            if (isStale()) return;
            console.error("Failed to load recommendation result:", err);
            // Đổi lịch sử mà fetch lỗi thì phải xoá dữ liệu cũ, không để nhãn mới trên số liệu cũ (DEF_157)
            setRecs([]);
            if (err.response?.status === 404) {
                setNeverRun(true);
            } else {
                setNeverRun(false);
                setLoadError(err.response?.data?.message || "Không tải được kết quả gợi ý. Vui lòng thử lại.");
            }
        }
    }, []);

    useEffect(() => {
        loadRecommendations(selectedResultId);
    }, [selectedResultId, loadRecommendations]);

    const handleReRun = async () => {
        if (isReRunning) return;
        setIsReRunning(true);
        try {
            await runRecommendation();
            const list = await getRecommendationHistory();
            setHistoryList(list || []);
            if (list && list.length > 0) {
                setSelectedResultId(list[0].id);
                await loadRecommendations(list[0].id);
            } else {
                await loadRecommendations();
            }
            // Hồ sơ có thể vừa được bổ sung trước khi bấm "Gợi ý lại" → đọc lại để thông điệp khớp thực tế.
            await loadProfileContext();
        } catch (err) {
            console.error("Failed to re-run recommendation:", err);
            // Không đổ nguyên message 5xx (có thể kèm stack trace) ra màn cho Student (DEF_159)
            const status = err.response?.status;
            setGateMessage(
                status >= 500
                    ? "Hệ thống đang gặp sự cố khi tính lại gợi ý. Vui lòng thử lại sau ít phút."
                    : err.response?.data?.message || "Có lỗi xảy ra khi gợi ý lại."
            );
        } finally {
            setIsReRunning(false);
        }
    };

    // Sort theo tier: rank ASC -> rawFinalScore DESC -> mục có dữ liệu hồ sơ trước mục không có
    // (BR-28/29: thiếu dữ liệu không được xếp ngang mục đã chấm đủ) -> rawProfileScore DESC -> code ASC
    const sortedRecs = useMemo(() => {
        return [...recs].sort((a, b) => {
            if ((a.rank || 0) !== (b.rank || 0)) return (a.rank || 0) - (b.rank || 0);
            if (b.rawFinalScore !== a.rawFinalScore) return b.rawFinalScore - a.rawFinalScore;
            // Tier riêng cho "không có dữ liệu fallback" (DEF_153)
            const aHasData = a.rawProfileScore != null;
            const bHasData = b.rawProfileScore != null;
            if (aHasData !== bHasData) return aHasData ? -1 : 1;
            if (aHasData && bHasData && b.rawProfileScore !== a.rawProfileScore) {
                return b.rawProfileScore - a.rawProfileScore;
            }
            return (a.code || "").localeCompare(b.code || "");
        });
    }, [recs]);

    // Đồng hạng phải căn cứ rank thật của server, không phải % đã làm tròn (DEF_151)
    const rankCounts = useMemo(() => {
        const rCounts = {};
        sortedRecs.forEach((r) => {
            if (r.rank != null) rCounts[r.rank] = (rCounts[r.rank] || 0) + 1;
        });
        return rCounts;
    }, [sortedRecs]);

    // Top 1 tied list: các mục cùng rank cao nhất do server xếp
    const top1s = useMemo(() => {
        if (sortedRecs.length === 0) return [];
        const topRank = sortedRecs[0].rank;
        if (topRank == null) return [sortedRecs[0]];
        return sortedRecs.filter((r) => r.rank === topRank);
    }, [sortedRecs]);

    // Ghi chú bắt buộc khi alpha bị kéo lệch khỏi mặc định 0.70 (DEF_155)
    const alphaNote = useMemo(() => {
        const withAlpha = recs.find((r) => r.alphaActual != null);
        if (!withAlpha) return null;
        const alpha = Number(withAlpha.alphaActual);
        return {
            profilePct: Math.round(alpha * 100),
            marketPct: 100 - Math.round(alpha * 100),
        };
    }, [recs]);

    const top1 = top1s[activeTop1Idx] || top1s[0] || sortedRecs[0];
    const others = top1 ? sortedRecs.filter((r) => r.id !== top1.id) : sortedRecs;

    // Chỉ dựng thông điệp khi đã có đủ cả kết quả lẫn hồ sơ, tránh khuyên sai vì dữ liệu chưa về.
    const guidance = useMemo(() => {
        if (!profileLoaded || !top1) return null;
        return buildGuidance({ top1, top1s, profile, skillsCount, interestsCount, hasTranscript });
    }, [profileLoaded, top1, top1s, profile, skillsCount, interestsCount, hasTranscript]);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const top1Ref = useRef(null);
    const othersRef = useRef(null);
    const top1Visible = useReveal(top1Ref);
    const othersVisible = useReveal(othersRef);

    return (
        <Layout
            role="student"
            user={isLoggedIn ? { name: username || "Sinh viên" } : { name: "Sinh viên" }}
            breadcrumbs={[
                { label: "Gợi ý chuyên ngành hẹp", href: "/student/recommendation" },
                { label: "Kết quả gợi ý" }
            ]}
            onLogout={handleLogout}
            onLogoClick={() => navigate("/")}
            onGoHome={() => navigate("/")}
        >
            <div className="rec-page">
                <main className="rec-content">
                    <div className="rec-container">
                        <div className="rec-hero">
                            <div className="rec-hero__main">
                                <div className="rec-hero__badge">
                                    <Sparkles width="13" height="13" />
                                    Kết quả phân tích độ tương thích
                                </div>
                                <div className="rec-hero__title-row">
                                    <span className="rec-hero__icon">
                                        <Sparkles size={20} />
                                    </span>
                                    <h1 className="rec-hero__title">
                                        Gợi ý Chuyên ngành hẹp Phù hợp nhất
                                    </h1>
                                </div>
                                <p className="rec-hero__desc">
                                    Dựa trên kỹ năng, sở thích, kết quả học tập và xu hướng thị trường việc làm hiện tại, đây là những chuyên ngành hẹp phù hợp nhất với bạn.
                                </p>
                            </div>
                            <div className="rec-hero__tools">
                                {historyList.length > 0 && (
                                    <div className="rec-history">
                                        <History size={14} color="#64748B" />
                                        <label htmlFor="history-select" className="rec-history__label">Lịch sử:</label>
                                        <select
                                            id="history-select"
                                            className="rec-history__select"
                                            value={selectedResultId}
                                            onChange={(e) => setSelectedResultId(e.target.value)}
                                        >
                                            {historyList.map((h, idx) => (
                                                <option key={h.id} value={h.id}>
                                                    {idx === 0 ? `Lần mới nhất (${formatHistoryDate(h.calculatedAt)})` : `Ngày ${formatHistoryDate(h.calculatedAt)}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="rec-page-refresh"
                                    onClick={handleReRun}
                                    disabled={isReRunning}
                                >
                                    <RefreshCw width="14" height="14" style={{ animation: isReRunning ? 'spin 1s linear infinite' : 'none' }} />
                                    {isReRunning ? "Đang gợi ý lại..." : "Gợi ý lại"}
                                </button>
                            </div>
                        </div>

                        {loadError && (
                            <section className="rec-guide rec-guide--warn">
                                <span className="rec-guide__icon"><AlertTriangle size={20} /></span>
                                <div className="rec-guide__body">
                                    <h3 className="rec-guide__title">Không tải được kết quả gợi ý</h3>
                                    <p className="rec-guide__text">{loadError}</p>
                                    <div className="rec-guide__actions">
                                        <button type="button" className="rec-guide__btn" onClick={() => loadRecommendations(selectedResultId)}>
                                            <RefreshCw size={13} />
                                            Thử lại
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Chưa từng chạy gợi ý: giải thích + lối ra, thay vì lưới trống im lặng (DEF_156) */}
                        {neverRun && !loadError && (
                            <section className="rec-guide rec-guide--info">
                                <span className="rec-guide__icon"><Info size={20} /></span>
                                <div className="rec-guide__body">
                                    <h3 className="rec-guide__title">Bạn chưa chạy gợi ý lần nào</h3>
                                    <p className="rec-guide__text">
                                        Hệ thống chưa có kết quả gợi ý nào cho tài khoản của bạn. Hãy kiểm tra hồ sơ
                                        (kỹ năng, sở thích, bảng điểm) rồi chạy gợi ý để nhận danh sách chuyên ngành hẹp phù hợp.
                                    </p>
                                    <div className="rec-guide__actions">
                                        <button type="button" className="rec-guide__btn" onClick={() => navigate("/student/recommendation?check=true")}>
                                            <UserCog size={13} />
                                            Kiểm tra hồ sơ &amp; chạy gợi ý
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Tỉ lệ Hồ sơ / Thị trường */}
                        {alphaNote && (
                            <section className="rec-guide rec-guide--info">
                                <span className="rec-guide__icon"><Info size={20} /></span>
                                <div className="rec-guide__body">
                                    <h3 className="rec-guide__title">Tỉ lệ Hồ sơ / Thị trường</h3>
                                    <p className="rec-guide__text">
                                        Lần chạy này dùng tỉ lệ <strong>{alphaNote.profilePct}% hồ sơ cá nhân</strong> / <strong>{alphaNote.marketPct}% xu hướng thị trường</strong>.
                                    </p>
                                </div>
                            </section>
                        )}

                        {top1s.length > 1 && (
                            <>
                                <div className="rec-tied-alert-banner">
                                    <span className="rec-tied-alert-banner__icon">
                                        <Trophy size={17} />
                                    </span>
                                    <div className="rec-tied-alert-banner__header">
                                        Phát hiện <strong>{top1s.length} chuyên ngành hẹp đồng hạng Top 1</strong> với điểm tương thích bằng nhau (<strong>{top1s[0].matchScore}%</strong>). Chọn từng lựa chọn bên dưới để so sánh.
                                    </div>
                                </div>

                                <div className="rec-top1__tabs-container">
                                    <span className="rec-top1__tabs-title">Đang xem</span>
                                    <div className="rec-top1__tabs-list">
                                        {top1s.map((item, idx) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`rec-top1__tab-btn ${idx === activeTop1Idx ? 'rec-top1__tab-btn--active' : ''}`}
                                                onClick={() => setActiveTop1Idx(idx)}
                                            >
                                                <Trophy width="12" height="12" />
                                                Lựa chọn {idx + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {top1 && (
                            <div
                                ref={top1Ref}
                                className="rec-reveal rec-visible"
                                style={{ transitionDelay: "100ms" }}
                            >
                                <section className="rec-top1">
                                    <div className="rec-top1__ribbon">
                                        <div className="rec-top1__ribbon-left">
                                            <Award width="15" height="15" />
                                            <span>Gợi ý hàng đầu dành cho bạn</span>
                                        </div>
                                        {top1s.length > 1 && (
                                            <div className="rec-top1__tied-tag">
                                                Đồng điểm Top 1 ({top1.matchScore}%)
                                            </div>
                                        )}
                                    </div>

                                    <div className="rec-top1__body">
                                        <div className="rec-top1__main">
                                            <span className="rec-top1__spec-badge">{top1.specName}</span>
                                            <h2 className="rec-top1__title">{top1.name}</h2>
                                            <span className="rec-top1__code">{top1.code}</span>
                                        </div>
                                        <div className="rec-top1__side">
                                            <MatchRing value={top1.matchScore} size={112} stroke={9} color="#F37021" animate={top1Visible} />
                                            <span className="rec-top1__side-label">Điểm tương thích</span>
                                        </div>
                                    </div>

                                    <div className="rec-top1__bars">
                                        <div className="rec-top1__bars-title">
                                            <Sparkles size={13} color="#94A3B8" />
                                            Điểm theo từng tiêu chí
                                        </div>
                                        <CompatBars breakdown={top1.breakdown} loadFailed={top1.detailLoadFailed} />
                                    </div>

                                    <div className="rec-top1__actions">
                                        <button
                                            className="rec-btn rec-btn--primary"
                                            onClick={() => navigate(`/student/recommendation/detail/${top1.id}${selectedResultId ? `?resultId=${selectedResultId}` : ''}`)}
                                        >
                                            <BookOpen width="14" height="14" />
                                            Xem chi tiết gợi ý
                                            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                                                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                        <button
                                            className="rec-btn rec-btn--ghost"
                                            onClick={() => navigate(`/student/roadmap/${top1.specId || 'select'}/${top1.id}`)}
                                        >
                                            <Compass width="14" height="14" />
                                            Xem lộ trình học
                                        </button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {guidance && (
                            <section className={`rec-guide rec-guide--${guidance.tone}`}>
                                <span className="rec-guide__icon">
                                    <guidance.icon size={20} />
                                </span>
                                <div className="rec-guide__body">
                                    <h3 className="rec-guide__title">{guidance.title}</h3>
                                    <p className="rec-guide__text">{guidance.message}</p>

                                    {guidance.note && (
                                        <p className="rec-guide__note">
                                            <Info size={13} />
                                            <span>{guidance.note}</span>
                                        </p>
                                    )}

                                    {guidance.checklist && (
                                        <ul className="rec-guide__checklist">
                                            {guidance.checklist.map((c) => (
                                                <li
                                                    key={c.label}
                                                    className={`rec-guide__check ${c.done ? "rec-guide__check--done" : "rec-guide__check--missing"}`}
                                                >
                                                    {c.done ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                                    <strong>{c.label}</strong>
                                                    <span>{c.detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {guidance.actions.length > 0 && (
                                        <div className="rec-guide__actions">
                                            {guidance.actions.map((a) => (
                                                <button
                                                    key={a.to}
                                                    type="button"
                                                    className="rec-guide__btn"
                                                    onClick={() => navigate(a.to)}
                                                >
                                                    <a.icon size={13} />
                                                    {a.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        <div
                            ref={othersRef}
                            className={`rec-reveal ${othersVisible ? "rec-visible" : ""}`}
                            style={{ transitionDelay: "150ms", display: (neverRun || loadError) ? "none" : undefined }}
                        >
                            <div className="rec-others__heading">
                                <span className="rec-others__heading-icon">
                                    <Sparkles size={17} />
                                </span>
                                <h3>Các gợi ý khác dành cho bạn</h3>
                                <span className="rec-others__count">{others.length} chuyên ngành hẹp</span>
                            </div>
                            {others.length === 0 ? (
                                <div className="rec-empty">
                                    <Sparkles size={26} color="#94A3B8" />
                                    Chưa có gợi ý nào khác. Hãy cập nhật hồ sơ rồi bấm “Gợi ý lại”.
                                </div>
                            ) : (
                                <div className="rec-grid">
                                    {others.map((item) => {
                                        const isTiedWithTop1 = top1s.some(t => t.id !== item.id && t.rank === item.rank);
                                        const isTiedGeneral = item.rank != null && rankCounts[item.rank] > 1;

                                        return (
                                            <div className="rec-card" key={item.id}>
                                                <div className="rec-card__rank-row">
                                                    <span className={rankMedalClass(item.rank)}>
                                                        <Medal size={12} />
                                                        Hạng {item.rank}
                                                    </span>
                                                    {isTiedWithTop1 ? (
                                                        <span className="rec-card__tied-badge rec-card__tied-badge--gold" title="Chuyên ngành hẹp này bằng điểm với Top 1">
                                                            ⭐ Đồng điểm Top 1 ({item.matchScore}%)
                                                        </span>
                                                    ) : isTiedGeneral ? (
                                                        <span className="rec-card__tied-badge" title="Chuyên ngành hẹp này bằng điểm với chuyên ngành khác">
                                                            ⚖️ Đồng hạng ({item.matchScore}%)
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="rec-card__head">
                                                    <MatchRing value={item.matchScore} size={72} stroke={7} color="#034EA2" animate={othersVisible} />
                                                    <div className="rec-card__meta">
                                                        <span className="rec-card__spec" title={item.specName}>{item.specName}</span>
                                                        <h4 className="rec-card__name">{item.name}</h4>
                                                        <span className="rec-card__code">{item.code}</span>
                                                    </div>
                                                </div>
                                                <div className="rec-card__bars">
                                                    <CompatBars breakdown={item.breakdown} loadFailed={item.detailLoadFailed} />
                                                </div>
                                                <div className="rec-card__footer">
                                                    <button
                                                        type="button"
                                                        className="rec-card__link"
                                                        onClick={() => navigate(`/student/recommendation/detail/${item.id}${selectedResultId ? `?resultId=${selectedResultId}` : ''}`)}
                                                    >
                                                        <BookOpen size={13} />
                                                        Xem chi tiết
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rec-card__roadmap"
                                                        onClick={() => navigate(`/student/roadmap/${item.specId || 'select'}/${item.id}`)}
                                                    >
                                                        <Compass size={13} />
                                                        Lộ trình học
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="rec-disclaimer">
                                <Info size={15} />
                                <span>
                                    Độ tương thích được tính từ <strong>Profile Score</strong> (kỹ năng, sở thích, kết quả học tập) kết hợp với <strong>Trending Weight</strong> — chỉ số phản ánh nhu cầu tuyển dụng thực tế trên thị trường lao động, cập nhật định kỳ.
                                </span>
                            </p>
                        </div>
                    </div>
                </main>
            </div>

            <RecommendGateModal message={gateMessage} onClose={() => setGateMessage("")} />
        </Layout>
    );
}