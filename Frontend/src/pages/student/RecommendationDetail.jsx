import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    Compass, Trophy, AlertCircle, CheckCircle, Sparkles, Target, Heart,
    GraduationCap, TrendingUp, Scale, UserPlus, Rocket, Briefcase, BarChart3,
    ArrowLeft, Search, ListTree, Home
} from "lucide-react";
import Layout from "../../components/layout/Layout";
import { logout } from "../../services/authService";
import {
    getRecommendationItemDetail,
    getLatestRecommendation,
    getRecommendationItemDetailByResult,
    getRecommendationResultById,
    getConsultationItemDetail,
    getConsultationItemDetailByResult
} from "../../services/recommendationService";
import "./RecommendationDetail.css";

// Hook for scroll-reveal animation
function useReveal(ref, threshold = 0.15, rootMargin = "0px 0px -60px 0px") {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold, rootMargin }
        );
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, [ref, threshold, rootMargin]);
    return visible;
}

/* Vòng tròn hiển thị % độ tương thích (SVG progress ring) */
function MatchRing({ value, size = 96, stroke = 8, color = "#F37021", animate = true }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const targetOffset = c - (value / 100) * c;
    const [offset, setOffset] = useState(animate ? c : targetOffset);
    const [displayVal, setDisplayVal] = useState(animate ? 0 : value);

    useEffect(() => {
        if (!animate) return;

        let start = null;
        const duration = 1200; // 1.2s animation
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

export default function NarrowSpecMatchDetailPage() {
    const navigate = useNavigate();
    const { narrowSpecId } = useParams();
    const [searchParams] = useSearchParams();
    const resultId = searchParams.get("resultId");

    const isLoggedIn = !!localStorage.getItem("accessToken");
    const username = localStorage.getItem("username");
    const user = isLoggedIn ? { name: username || "Người dùng" } : null;

    const [detail, setDetail] = useState(null);
    const [ranking, setRanking] = useState([]);
    const [consultationText, setConsultationText] = useState(null);
    const [relatedJobs, setRelatedJobs] = useState([]);
    const [isConsultationLoading, setIsConsultationLoading] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    // Ô tìm kiếm trong thanh xếp hạng nổi (VẤN ĐỀ 5)
    const [rankSearch, setRankSearch] = useState("");

    // ── FIX VẤN ĐỀ 3 (race condition): mỗi lượt tải gắn cờ "cancelled" riêng.
    // Nếu bấm sang mục khác trước khi lượt tải cũ kịp về, response cũ tới trễ
    // sẽ bị bỏ qua thay vì đè nhầm lên state của mục đang xem — tránh hiện sai
    // dữ liệu khi bấm nhiều lần liên tục trong thanh xếp hạng.
    // Created by: BaoTQ - 20260814
    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            if (!narrowSpecId) return;
            try {
                const [itemDetail, resultData] = await Promise.all([
                    resultId
                        ? getRecommendationItemDetailByResult(resultId, narrowSpecId)
                        : getRecommendationItemDetail(narrowSpecId),
                    resultId
                        ? getRecommendationResultById(resultId).catch(() => null)
                        : getLatestRecommendation().catch(() => null)
                ]);
                if (cancelled) return; // đã chuyển sang mục khác trong lúc chờ — bỏ kết quả cũ

                setDetail(itemDetail);
                if (resultData && resultData.items) {
                    setRanking(resultData.items.map(it => ({
                        rank: it.rank,
                        name: it.narrowSpecName,
                        code: it.narrowSpecCode,
                        id: it.narrowSpecId,
                        percent: Math.round(it.finalScore || 0),
                        isBest: it.rank === 1
                    })));
                }
                setDetailError(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load recommendation item detail:", err);
                setDetail(null);
                setDetailError(
                    err.response?.status === 404
                        ? "Không tìm thấy phân tích cho chuyên ngành hẹp này. Có thể kết quả gợi ý đã bị xoá hoặc chưa được tính."
                        : err.response?.data?.message || "Không tải được phân tích chi tiết của chuyên ngành hẹp này."
                );
            }
        };

        const loadConsultation = async () => {
            if (!narrowSpecId) return;
            setIsConsultationLoading(true);
            try {
                const response = resultId
                    ? await getConsultationItemDetailByResult(resultId, narrowSpecId)
                    : await getConsultationItemDetail(narrowSpecId);
                if (cancelled) return;
                setConsultationText(response.text);
                const rawJobs = response.relatedJobs || [];
                setRelatedJobs(Array.from(new Set(rawJobs)));
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load consultation text:", err);
            } finally {
                if (!cancelled) setIsConsultationLoading(false);
            }
        };

        loadData();
        loadConsultation();

        return () => {
            cancelled = true;
        };
    }, [narrowSpecId, resultId, reloadKey]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [narrowSpecId]);

    const narrowSpec = {
        name: detail?.narrowSpecName || "Chuyên ngành hẹp",
        code: detail?.narrowSpecCode || "",
        matchPercent: Math.round(detail?.finalScore || 0),
    };

    // Vị trí của chuyên ngành hẹp đang xem trong bảng xếp hạng (dùng cho chip ở hero + handle thanh nổi)
    const currentRank = ranking.find((r) => r.id === narrowSpecId)?.rank;

    // Mặc định nghiệp vụ khi thiếu weight snapshot: 40% học tập / 35% kỹ năng / 25% sở thích (DEF_162)
    const DEFAULT_W_GPA = 0.40;
    const DEFAULT_W_SKILL = 0.35;
    const DEFAULT_W_INT = 0.25;

    // Mỗi tiêu chí có 1 bộ màu (đậm / pastel / viền) để card tự nhận diện bằng màu
    const scoreBreakdown = [
        { key: "gpa", label: "Kết quả học tập", icon: GraduationCap, weight: Math.round((detail?.wGpaSnapshot || DEFAULT_W_GPA) * 100), score: Math.round(detail?.gpaScore || 0), color: "#034EA2", soft: "#F2F7FD", line: "#C3D8F2", deep: "#023880" },
        { key: "skill", label: "Kỹ năng", icon: Target, weight: Math.round((detail?.wSkillSnapshot || DEFAULT_W_SKILL) * 100), score: Math.round(detail?.skillScore || 0), color: "#F37021", soft: "#FFF8F3", line: "#FCD9B8", deep: "#C2540F" },
        { key: "interest", label: "Sở thích", icon: Heart, weight: Math.round((detail?.wIntSnapshot || DEFAULT_W_INT) * 100), score: Math.round(detail?.interestScore || 0), color: "#51B848", soft: "#F5FCF4", line: "#BBE7B5", deep: "#2F7A28" },
        { key: "market", label: "Trọng số thị trường", icon: TrendingUp, weight: null, score: Math.round(detail?.trendingWeightSnapshot || 0), color: "#0EA5A5", soft: "#F1FBFB", line: "#A7E4E4", deep: "#0B7A7A" },
    ];

    const marketSignals = [
        { key: "trending", label: "Trọng số thị trường", icon: TrendingUp, value: `${Math.round(detail?.trendingWeightSnapshot || 0)}/100`, sub: "Dữ liệu thị trường hiện tại" },
        {
            key: "alpha",
            label: "Tỷ lệ Hồ sơ / Thị trường",
            icon: Scale,
            value: `${Math.round((detail?.alphaActual ?? 0.7) * 100)}% / ${100 - Math.round((detail?.alphaActual ?? 0.7) * 100)}%`,
            sub: "Trọng số dùng khi tính điểm cuối",
            isFallback: false,
        },
        { key: "juniorRatio", label: "Cơ hội cho sinh viên mới tốt nghiệp", icon: UserPlus, value: detail?.juniorRatio != null ? `${Math.round(detail.juniorRatio * 100)}%` : "N/A", sub: "Độ dễ có việc làm ở vị trí Junior" },
        { key: "sacc", label: "Tốc độ tăng trưởng", icon: Rocket, value: detail?.sacc != null ? `${detail.sacc >= 0 ? '+' : ''}${Math.round(detail.sacc * 100)}%` : "N/A", sub: "Gia tốc nhu cầu của thị trường" },
        { key: "svol", label: "Khối lượng công việc", icon: Briefcase, value: detail?.svol != null ? `${detail.svol}` : "N/A", sub: "Tổng bài tuyển dụng ghi nhận" },
    ];

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    // Scroll reveal refs and hooks
    const heroRef = useRef(null);
    const topGridRef = useRef(null);
    const jobsRef = useRef(null);
    const scoreRef = useRef(null);
    const marketRef = useRef(null);
    const gapRef = useRef(null);

    const heroVisible = useReveal(heroRef, 0.05, "0px");
    const topGridVisible = useReveal(topGridRef, 0.05, "0px");
    // FIX: khối job trước đây dùng chung topGridVisible (của khối AI phía trên) —
    // giờ có observer riêng, không còn phụ thuộc trạng thái hiện/ẩn của khối khác.
    const jobsVisible = useReveal(jobsRef, 0.05, "0px");
    const scoreVisible = useReveal(scoreRef, 0.15, "0px 0px -60px 0px");
    const marketVisible = useReveal(marketRef, 0.15, "0px 0px -60px 0px");
    const gapVisible = useReveal(gapRef, 0.15, "0px 0px -60px 0px");

    // ── VẤN ĐỀ 6: thanh điều hướng nhảy nhanh tới từng khối trong trang ──
    // Created by: BaoTQ - 260814
    // FIX: bỏ mục "Cơ hội nghề nghiệp" khỏi danh sách khi chưa có job nào —
    // tránh cho bấm vào 1 khối cao 0px (cuộn tới chỗ trống, không thấy gì).
    const sectionNav = [
        { key: "hero", label: "Tổng quan", icon: Home, ref: heroRef },
        { key: "ai", label: "Cố vấn AI", icon: Sparkles, ref: topGridRef },
        ...(relatedJobs.length > 0
            ? [{ key: "jobs", label: "Cơ hội nghề nghiệp", icon: Briefcase, ref: jobsRef }]
            : []),
        { key: "score", label: "Điểm số chi tiết", icon: BarChart3, ref: scoreRef },
        { key: "market", label: "Tín hiệu thị trường", icon: TrendingUp, ref: marketRef },
        { key: "skills", label: "Kỹ năng", icon: CheckCircle, ref: gapRef },
    ];
    const scrollToSection = (ref) => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // ── VẤN ĐỀ 5: lọc danh sách xếp hạng theo ô tìm kiếm (không phân biệt hoa/thường) ──
    // Created by: BaoTQ - 260813
    const filteredRanking = useMemo(() => {
        const q = rankSearch.trim().toLowerCase();
        if (!q) return ranking;
        return ranking.filter(
            (item) =>
                item.name?.toLowerCase().includes(q) ||
                item.code?.toLowerCase().includes(q)
        );
    }, [ranking, rankSearch]);

    return (
        <Layout
            role="student"
            user={user || { name: "Sinh viên" }}
            breadcrumbs={[
                { label: "Gợi ý chuyên ngành hẹp", href: "/student/recommendation" },
                { label: "Kết quả gợi ý", href: "/student/recommendation/result" },
                { label: narrowSpec.name }
            ]}
            onLogout={handleLogout}
            onLogoClick={() => navigate("/")}
            onGoHome={() => navigate("/")}
        >
            <div className="msd-page">
                {/* ── Thanh nổi #1: Bảng xếp hạng chuyên ngành hẹp (bên phải màn hình) ── */}
                {ranking.length > 0 && (
                    <div className="msd-floating-rank">
                        <div className="msd-floating-rank__handle">
                            <Trophy size={14} />
                            {currentRank && <span className="msd-floating-rank__handle-rank">#{currentRank}</span>}
                        </div>
                        <div className="msd-floating-rank__body">
                            <h3 className="msd-floating-rank__title">
                                <Trophy size={14} style={{ color: "#F37021" }} />
                                Gợi ý chuyên ngành hẹp
                            </h3>

                            <div className="msd-floating-rank__search">
                                <Search size={13} />
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên hoặc mã..."
                                    value={rankSearch}
                                    onChange={(e) => setRankSearch(e.target.value)}
                                />
                            </div>

                            <div className="msd-floating-rank__list">
                                {filteredRanking.length === 0 && (
                                    <p className="msd-floating-rank__empty">Không tìm thấy chuyên ngành hẹp phù hợp.</p>
                                )}
                                {filteredRanking.map((item) => {
                                    const isSelected = item.id === narrowSpecId;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`msd-floating-rank__item${isSelected ? " msd-floating-rank__item--active" : ""}`}
                                            onClick={() => !isSelected && navigate(`/student/recommendation/detail/${item.id}${resultId ? `?resultId=${resultId}` : ''}`)}
                                            title={item.name}
                                        >
                                            <span className="msd-floating-rank__num">#{item.rank}</span>
                                            <span className="msd-floating-rank__name">{item.name}</span>
                                            <span className="msd-floating-rank__pct">{item.percent}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Thanh nổi #2: Điều hướng nhanh tới từng khối trong trang (VẤN ĐỀ 6) ── */}
                <div className="msd-floating-nav">
                    <div className="msd-floating-nav__handle">
                        <ListTree size={14} />
                    </div>
                    <div className="msd-floating-nav__body">
                        <h3 className="msd-floating-rank__title">
                            <ListTree size={14} style={{ color: "#034EA2" }} />
                            Đi tới phần
                        </h3>
                        <div className="msd-floating-rank__list">
                            {sectionNav.map((s) => {
                                const SecIcon = s.icon;
                                return (
                                    <div
                                        key={s.key}
                                        className="msd-floating-nav__item"
                                        onClick={() => scrollToSection(s.ref)}
                                    >
                                        <span className="msd-floating-nav__icon"><SecIcon size={13} /></span>
                                        <span className="msd-floating-rank__name">{s.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <main className="msd-content">
                    <div className="msd-container">

                        {detailError && (
                            <section className="msd-section">
                                <div className="msd-ai-card" style={{ borderColor: '#FECACA', background: '#FEF2F2' }}>
                                    <h2 className="msd-section__title" style={{ color: '#B91C1C' }}>Không tải được dữ liệu phân tích</h2>
                                    <p className="msd-section__desc">{detailError}</p>
                                    <div className="msd-hero__actions">
                                        <button className="msd-btn msd-btn--primary" onClick={() => setReloadKey((k) => k + 1)}>
                                            Thử lại
                                        </button>
                                        <button className="msd-btn msd-btn--ghost" onClick={() => navigate("/student/recommendation/result")}>
                                            <ArrowLeft size={15} />
                                            Về danh sách gợi ý
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* ── 1. Hero ── */}
                        <div
                            ref={heroRef}
                            className={`msd-reveal ${heroVisible ? "msd-visible" : ""}`}
                            style={{ transitionDelay: "80ms", scrollMarginTop: "150px" }}
                        >
                            <section className="msd-hero">
                                <div className="msd-hero__main">
                                    <div className="msd-hero__chips">
                                        {currentRank && (
                                            <span className="msd-chip msd-chip--rank">
                                                <Trophy size={12} />
                                                Hạng {currentRank} trong gợi ý của bạn
                                            </span>
                                        )}
                                        {detail?.specializationName && (
                                            <span className="msd-chip msd-chip--spec">{detail.specializationName}</span>
                                        )}
                                    </div>
                                    <h1 className="msd-hero__title">{narrowSpec.name}</h1>
                                    {narrowSpec.code && <span className="msd-hero__code">{narrowSpec.code}</span>}

                                    <div className="msd-hero__actions">
                                        <button
                                            className="msd-btn msd-btn--primary"
                                            onClick={() => navigate(`/student/roadmap/${detail?.specializationId || 'select'}/${narrowSpecId}`)}
                                        >
                                            <Compass size={15} />
                                            Xem lộ trình học
                                        </button>
                                        <button
                                            className="msd-btn msd-btn--ghost"
                                            onClick={() => navigate("/student/recommendation/result")}
                                        >
                                            <ArrowLeft size={15} />
                                            Về danh sách gợi ý
                                        </button>
                                    </div>
                                </div>

                                <div className="msd-hero__ring">
                                    <MatchRing value={narrowSpec.matchPercent} size={116} stroke={9} color="#F37021" animate={heroVisible} />
                                    <span className="msd-hero__ring-label">Điểm tương thích</span>
                                </div>
                            </section>
                        </div>

                        {/* ── 2. Cố vấn học vụ AI ── */}
                        <div
                            ref={topGridRef}
                            className={`msd-reveal ${topGridVisible ? "msd-visible" : ""}`}
                            style={{ transitionDelay: "120ms", scrollMarginTop: "90px" }}
                        >
                            <section className="msd-section">
                                <div className="msd-ai-card">
                                    <h2 className="msd-section__title">
                                        <span
                                            className="msd-section__icon"
                                            style={{ "--sec-soft": "#F1EBFE", "--sec-line": "#D6C6FB", "--sec-color": "#7C3AED" }}
                                        >
                                            <Sparkles size={18} />
                                        </span>
                                        Cố vấn học vụ AI
                                    </h2>

                                    {isConsultationLoading ? (
                                        <div className="msd-ai-skeleton">
                                            <span />
                                            <span />
                                            <span />
                                            <p>Đang phân tích dữ liệu chuyên ngành...</p>
                                        </div>
                                    ) : (
                                        <div className="msd-ai-text">
                                            {consultationText || "Hiện tại không thể tải được tư vấn AI. Vui lòng thử lại sau."}
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* ── 2.5. Cơ hội nghề nghiệp liên quan (ngay dưới Cố vấn AI) ──
                             FIX: dùng jobsVisible riêng (không ăn theo topGridVisible nữa) +
                             scrollMarginTop đặt ngay trên div ngoài cùng có ref (kể cả khi
                             relatedJobs rỗng, để scrollMarginTop luôn có tác dụng nếu sau này
                             có logic khác trỏ tới jobsRef). ── */}
                        <div ref={jobsRef} style={{ scrollMarginTop: "90px" }}>
                            {relatedJobs.length > 0 && (
                                <div
                                    className={`msd-reveal ${jobsVisible ? "msd-visible" : ""}`}
                                    style={{ transitionDelay: "140ms" }}
                                >
                                    <section className="msd-section">
                                        <div className="msd-ai-card msd-jobs-card">
                                            <h2 className="msd-section__title">
                                                <span
                                                    className="msd-section__icon"
                                                    style={{ "--sec-soft": "#E4F7F7", "--sec-line": "#A7E4E4", "--sec-color": "#0B7A7A" }}
                                                >
                                                    <Briefcase size={18} />
                                                </span>
                                                Cơ hội nghề nghiệp liên quan
                                                <span className="msd-chip msd-chip--spec" style={{ marginLeft: "10px" }}>
                                                    {relatedJobs.length} vị trí thực tế
                                                </span>
                                            </h2>
                                            <p className="msd-section__desc" style={{ marginLeft: 0 }}>
                                                Các vị trí công việc thực tế được ghi nhận từ thị trường tuyển dụng gần đây. Bấm vào vị trí để xem chi tiết trên VietnamWorks.
                                            </p>
                                            <div className="msd-job-chips">
                                                {relatedJobs.map((job, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={`https://www.vietnamworks.com/viec-lam?q=${encodeURIComponent(job)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="msd-chip msd-chip--job"
                                                    >
                                                        <Briefcase size={12} style={{ marginRight: "6px" }} />
                                                        {job}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>

                        {/* ── 3. Chi tiết điểm số phù hợp ── */}
                        <div
                            ref={scoreRef}
                            className={`msd-reveal ${scoreVisible ? "msd-visible" : ""}`}
                            style={{ transitionDelay: "150ms", scrollMarginTop: "90px" }}
                        >
                            <section className="msd-section">
                                <h2 className="msd-section__title">
                                    <span
                                        className="msd-section__icon"
                                        style={{ "--sec-soft": "#E6EEF9", "--sec-line": "#C3D8F2", "--sec-color": "#034EA2" }}
                                    >
                                        <BarChart3 size={18} />
                                    </span>
                                    Chi tiết điểm số phù hợp
                                </h2>
                                <p className="msd-section__desc">
                                    Điểm tương thích được ghép từ bốn tiêu chí dưới đây; phần trăm trong ngoặc là trọng số của tiêu chí đó khi tính điểm.
                                </p>

                                <div className="msd-score-grid">
                                    {scoreBreakdown.map((s) => {
                                        const ScoreIcon = s.icon;
                                        return (
                                            <div
                                                className="msd-score-card"
                                                key={s.key}
                                                style={{
                                                    "--score-color": s.color,
                                                    "--score-soft": s.soft,
                                                    "--score-line": s.line,
                                                    "--score-deep": s.deep,
                                                }}
                                            >
                                                <div className="msd-score-card__head">
                                                    <span className="msd-score-card__icon">
                                                        <ScoreIcon size={16} />
                                                    </span>
                                                    <span className="msd-score-card__weight">
                                                        {s.weight ? `Trọng số ${s.weight}%` : "Thị trường"}
                                                    </span>
                                                </div>
                                                <span className="msd-score-card__label">{s.label}</span>
                                                <strong className="msd-score-card__value">{s.score}<span>/100</span></strong>
                                                <div className="msd-score-card__track">
                                                    <div
                                                        className="msd-score-card__fill"
                                                        style={{ width: scoreVisible ? `${s.score}%` : "0%" }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        {/* ── 4. Tín hiệu thị trường ── */}
                        <div
                            ref={marketRef}
                            className={`msd-reveal ${marketVisible ? "msd-visible" : ""}`}
                            style={{ transitionDelay: "200ms", scrollMarginTop: "90px" }}
                        >
                            <section className="msd-section">
                                <h2 className="msd-section__title">
                                    <span
                                        className="msd-section__icon"
                                        style={{ "--sec-soft": "#E4F7F7", "--sec-line": "#A7E4E4", "--sec-color": "#0B7A7A" }}
                                    >
                                        <TrendingUp size={18} />
                                    </span>
                                    Tín hiệu thị trường &amp; thống kê việc làm
                                </h2>
                                <p className="msd-section__desc">
                                    Các chỉ số phản ánh nhu cầu tuyển dụng thực tế của chuyên ngành hẹp này trên thị trường lao động.
                                </p>

                                <div className="msd-market-grid">
                                    {marketSignals.map((m) => {
                                        const MarketIcon = m.icon;
                                        return (
                                            <div className="msd-market-card" key={m.key}>
                                                <span className="msd-market-card__icon">
                                                    <MarketIcon size={16} />
                                                </span>
                                                <span className="msd-market-card__label">{m.label}</span>
                                                <div className="msd-market-card__row">
                                                    <strong>{m.value}</strong>
                                                    {m.isFallback && (
                                                        <span className="msd-chip msd-chip--spec" style={{ marginLeft: '8px' }}>Giá trị mặc định</span>
                                                    )}
                                                </div>
                                                {m.sub && <span className="msd-market-card__sub">{m.sub}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        {/* ── 5. Phân tích Kỹ năng chuyên ngành hẹp ── */}
                        <div
                            ref={gapRef}
                            className={`msd-reveal ${gapVisible ? "msd-visible" : ""}`}
                            style={{ transitionDelay: "250ms", scrollMarginTop: "90px" }}
                        >
                            <section className="msd-section">
                                <h2 className="msd-section__title">
                                    <span
                                        className="msd-section__icon"
                                        style={{ "--sec-soft": "#EBF8EA", "--sec-line": "#BBE7B5", "--sec-color": "#2F7A28" }}
                                    >
                                        <CheckCircle size={18} />
                                    </span>
                                    Kỹ năng bạn đã có &amp; kỹ năng cần bổ sung
                                </h2>
                                <p className="msd-section__desc">
                                    Tổng hợp các kỹ năng nòng cốt được yêu cầu cho chuyên ngành hẹp này, bao gồm những kỹ năng bạn đã đáp ứng và những kỹ năng cần phát triển thêm.
                                </p>

                                {detail?.skillGap && detail.skillGap.length > 0 ? (
                                    <div className="msd-gap-grid">
                                        {/* Kỹ năng sinh viên đã có */}
                                        <div className="msd-gap-panel msd-gap-panel--have">
                                            <div className="msd-gap-panel__head">
                                                <CheckCircle size={17} />
                                                <span>Kỹ năng bạn đã có</span>
                                                <span className="msd-gap-panel__count">
                                                    {detail.skillGap.filter(s => s.studentHas).length}
                                                </span>
                                            </div>
                                            <div className="msd-gap-tags">
                                                {detail.skillGap.filter(s => s.studentHas).length > 0 ? (
                                                    detail.skillGap.filter(s => s.studentHas).map((sk) => (
                                                        <span className="msd-skill-tag msd-skill-tag--have" key={sk.id || sk.name}>
                                                            <CheckCircle size={12} />
                                                            {sk.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="msd-gap-empty">Chưa ghi nhận kỹ năng phù hợp</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Kỹ năng còn thiếu */}
                                        <div className="msd-gap-panel msd-gap-panel--missing">
                                            <div className="msd-gap-panel__head">
                                                <AlertCircle size={17} />
                                                <span>Kỹ năng cần tích lũy thêm</span>
                                                <span className="msd-gap-panel__count">
                                                    {detail.skillGap.filter(s => !s.studentHas).length}
                                                </span>
                                            </div>
                                            <div className="msd-gap-tags">
                                                {detail.skillGap.filter(s => !s.studentHas).length > 0 ? (
                                                    detail.skillGap.filter(s => !s.studentHas).map((sk) => (
                                                        <span className="msd-skill-tag msd-skill-tag--missing" key={sk.id || sk.name}>
                                                            <AlertCircle size={12} />
                                                            {sk.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="msd-gap-empty">🎉 Bạn đã có đầy đủ tất cả kỹ năng yêu cầu!</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="msd-empty-note">
                                        Đang cập nhật danh sách kỹ năng cho chuyên ngành hẹp này.
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* ── Bảng xếp hạng dạng danh sách ở cuối trang đã BỎ (VẤN ĐỀ 5) ──
                             Thay thế hoàn toàn bởi thanh nổi bên phải (đã có search + scroll). ── */}

                    </div>
                </main>
            </div>
        </Layout>
    );
}