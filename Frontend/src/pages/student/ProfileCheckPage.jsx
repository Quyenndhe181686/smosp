import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import { logout } from "../../services/authService";
import { runRecommendation, getLatestRecommendation } from "../../services/recommendationService";
import { useProfileFlow } from "../../components/student/profileFlow";
import RecommendGateModal from "../../components/student/RecommendGateModal";
import "./ProfileCheckPage.css";

const CHECK_ICONS = {
    skills: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M14.7 6.3a3 3 0 0 1 4.24 4.24l-1.06 1.06M9.3 17.7a3 3 0 0 1-4.24-4.24l1.06-1.06"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.5 15.5l7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M11.5 6.5l1.5-1.5 3 3-1.5 1.5M12.5 17.5l-1.5 1.5-3-3 1.5-1.5"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    interests: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 20s-7.2-4.4-9.5-9C.9 7.2 3 4 6.4 4c2 0 3.4 1.1 4.1 2.2C11.2 5.1 12.6 4 14.6 4 18 4 20.1 7.2 18.6 11 16.3 15.6 12 20 12 20z"
                stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
    ),
    transcript: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M8 12.5h8M8 15.5h8M8 9.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    ),
};

// Hook for scroll-reveal animation
function useReveal(ref) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (!node) {
            setVisible(true);
            return;
        }
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.05 }
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, [ref]);
    return visible;
}

export default function ProfileCheckPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const isForceCheck = new URLSearchParams(location.search).get("check") === "true";

    const username = localStorage.getItem("username") || "Sinh viên";
    const [loadingRecommend, setLoadingRecommend] = useState(false);
    const [gateMessage, setGateMessage] = useState("");

    const { completion, loading } = useProfileFlow(null);

    useEffect(() => {
        if (!isForceCheck) {
            getLatestRecommendation()
                .then((data) => {
                    if (data && data.items && data.items.length > 0) {
                        navigate("/student/recommendation/result", { replace: true });
                    }
                })
                .catch(() => {});
        }
    }, [isForceCheck, navigate]);

    // Use states from completion
    const skillsCount = completion?.skillsCount || 0;
    const interestsCount = completion?.interestsCount || 0;
    const transcriptCount = completion?.transcriptCount || 0;
    const isTranscriptDone = completion?.transcript || false;
    
    const loadFailed = completion?.loadFailed || { skills: false, interests: false, transcript: false };
    const anyLoadFailed = loadFailed.skills || loadFailed.interests || loadFailed.transcript;

    const status = {
        skills: {
            label: "Kỹ năng",
            done: completion?.skills || false,
            failed: loadFailed.skills,
            count: skillsCount,
            hint: skillsCount > 0 ? `${skillsCount} kỹ năng đã được chọn` : "Bạn chưa khai báo kỹ năng nào",
            emptyHint: loadFailed.skills ? "Không tải được danh sách kỹ năng — chưa xác định được trạng thái" : "Bạn chưa khai báo kỹ năng nào",
            updatedAt: skillsCount > 0 ? "Đã cập nhật" : null,
            path: "/student/profile/skills",
        },
        interests: {
            label: "Sở thích",
            done: completion?.interests || false,
            failed: loadFailed.interests,
            count: interestsCount,
            hint: interestsCount > 0 ? `${interestsCount} sở thích đã được chọn` : "Bạn chưa khai báo sở thích nào",
            emptyHint: loadFailed.interests ? "Không tải được danh sách sở thích — chưa xác định được trạng thái" : "Bạn chưa khai báo sở thích nào",
            updatedAt: interestsCount > 0 ? "Đã cập nhật" : null,
            path: "/student/profile/interests",
        },
        transcript: {
            label: "Bảng điểm",
            done: isTranscriptDone,
            failed: loadFailed.transcript,
            count: transcriptCount,
            hint: isTranscriptDone ? (transcriptCount > 0 ? `${transcriptCount} môn học đã được cập nhật` : "Bảng điểm đã được cập nhật") : "Bạn chưa tải lên / nhập bảng điểm",
            emptyHint: loadFailed.transcript ? "Không tải được bảng điểm — chưa xác định được trạng thái" : "Bạn chưa tải lên / nhập bảng điểm",
            updatedAt: isTranscriptDone ? "Đã cập nhật" : null,
            path: "/student/profile/transcript",
        },
    };

    const items = Object.entries(status).map(([key, val]) => ({ key, ...val }));
    const doneCount = items.filter((i) => i.done).length;
    const total = items.length;
    const percent = Math.round((doneCount / total) * 100);
    const allDone = doneCount === total;

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const handleRecommend = async () => {
        if (loadingRecommend) return;
        setLoadingRecommend(true);
        try {
            await runRecommendation();
            navigate("/student/recommendation/result");
        } catch (err) {
            console.error("Failed to run recommendation:", err);
            setGateMessage(err.response?.data?.message || err.message || "Có lỗi xảy ra khi chạy thuật toán gợi ý");
        } finally {
            setLoadingRecommend(false);
        }
    };

    // Scroll reveal refs and hooks
    const headerRef = useRef(null);
    const gridRef = useRef(null);
    const bannerRef = useRef(null);
    const ctaRef = useRef(null);

    const headerVisible = useReveal(headerRef);
    const gridVisible = useReveal(gridRef);
    const bannerVisible = useReveal(bannerRef);
    const ctaVisible = useReveal(ctaRef);

    return (
        <Layout
            role="student"
            user={{ name: username }}
            breadcrumbs={[
                { label: "Gợi ý chuyên ngành hẹp" }
            ]}
            onLogout={handleLogout}
            onLogoClick={() => navigate("/")}
            onGoHome={() => navigate("/")}
        >
            <div className="pcheck-page">
                <main className="pcheck-content">
                    <div className="pcheck-container">
                        {/* Header title area (Light design, no dark block) */}
                        <div
                            ref={headerRef}
                            className={`pcheck-reveal ${headerVisible ? "pcheck-visible" : ""}`}
                        >
                            <div className="pcheck-page-header">
                                <span className="pcheck-page-eyebrow">Khám phá chuyên ngành</span>
                                <h1 className="pcheck-page-title">Độ hoàn thiện hồ sơ</h1>
                                <p className="pcheck-page-subtitle">
                                    Hệ thống cần đầy đủ dữ liệu về kỹ năng, sở thích và bảng điểm để đưa ra gợi ý chuyên ngành hẹp chính xác nhất dành cho bạn.
                                </p>
                                <div className="pcheck-progress">
                                    <div className="pcheck-progress__track">
                                        <div
                                            className="pcheck-progress__fill"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <span className="pcheck-progress__label">
                                        {doneCount}/{total} mục hoàn thành · {percent}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Checklist Grid */}
                        <div
                            ref={gridRef}
                            className={`pcheck-reveal ${gridVisible ? "pcheck-visible" : ""}`}
                            style={{ transitionDelay: "100ms" }}
                        >
                            <div className="pcheck-grid">
                                {items.map((item) => (
                                    <button
                                        key={item.key}
                                        className={`pcheck-card${item.done ? " pcheck-card--done" : " pcheck-card--pending"}`}
                                        onClick={() => navigate(item.path)}
                                    >
                                        <div className="pcheck-card__top">
                                            <span className="pcheck-card__icon">{CHECK_ICONS[item.key]}</span>
                                            <span
                                                className={`pcheck-card__badge${item.done ? " pcheck-card__badge--done" : " pcheck-card__badge--pending"}`}
                                            >
                                                {item.done ? (
                                                    <>
                                                        <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                                                            <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                        Hoàn thành
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="9" height="9" viewBox="0 0 20 20" fill="none">
                                                            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2" />
                                                            <path d="M10 6.5v4.2M10 13.4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                        </svg>
                                                        {item.failed ? "Lỗi tải dữ liệu" : "Chưa hoàn thành"}
                                                    </>
                                                )}
                                            </span>
                                        </div>

                                        <h3 className="pcheck-card__title">{item.label}</h3>
                                        <p className="pcheck-card__desc">
                                            {item.done ? item.hint : item.emptyHint}
                                        </p>

                                        <div className="pcheck-card__footer">
                                            <span className="pcheck-card__meta">
                                                {item.updatedAt ? `Cập nhật ${item.updatedAt}` : item.failed ? "Không đọc được dữ liệu" : "Chưa có dữ liệu"}
                                            </span>
                                            <span className="pcheck-card__link">
                                                {item.done ? "Xem lại" : "Cập nhật"}
                                                <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                                                    <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Banner status */}
                        <div
                            ref={bannerRef}
                            className={`pcheck-reveal ${bannerVisible ? "pcheck-visible" : ""}`}
                            style={{ transitionDelay: "150ms" }}
                        >
                            <div className={`pcheck-banner${allDone ? " pcheck-banner--success" : " pcheck-banner--warning"}`}>
                                <span className="pcheck-banner__icon">
                                    {allDone ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
                                            <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2.5l10 18H2l10-18z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                            <path d="M12 9.5v5M12 17.3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    )}
                                </span>

                                <div className="pcheck-banner__text">
                                    {anyLoadFailed ? (
                                        <>
                                            <strong>Chưa đọc được đầy đủ hồ sơ!</strong>
                                            <p>
                                                Một số mục không tải được do lỗi hệ thống nên trạng thái phía trên có thể không đúng.{' '}
                                                <button type="button" className="pcheck-card__link" onClick={() => window.location.reload()}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                                                    Thử tải lại
                                                </button>
                                            </p>
                                        </>
                                    ) : allDone ? (
                                        <>
                                            <strong>Hồ sơ của bạn đã sẵn sàng!</strong>
                                            <p>Bạn có thể nhận gợi ý chuyên ngành hẹp phù hợp ngay bây giờ.</p>
                                        </>
                                    ) : (
                                        <>
                                            <strong>Hồ sơ chưa đầy đủ!</strong>
                                            <p>
                                                Kết quả phân tích có thể kém chính xác hơn
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CTA action */}
                        <div
                            ref={ctaRef}
                            className={`pcheck-reveal ${ctaVisible ? "pcheck-visible" : ""}`}
                            style={{ transitionDelay: "200ms" }}
                        >
                            <div className="pcheck-cta">
                                <button
                                    className={`pcheck-cta__btn${loadingRecommend ? " pcheck-cta__btn--loading" : ""}`}
                                    onClick={handleRecommend}
                                    disabled={loadingRecommend}
                                >
                                    {loadingRecommend ? (
                                        <>
                                            <span className="pcheck-cta__spinner" />
                                            Đang phân tích hồ sơ...
                                        </>
                                    ) : (
                                        <>
                                            Gợi ý chuyên ngành hẹp
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                                {!allDone && (
                                    <p className="pcheck-cta__note" style={{ color: "#E05A00" }}>
                                        {`Còn thiếu ${items.filter((i) => !i.done).map((i) => i.label.toLowerCase()).join(', ')}. `}
                                        Bạn vẫn có thể chạy gợi ý ngay, nhưng hệ thống sẽ thiếu dữ liệu để chấm điểm phù hợp
                                        nên kết quả sẽ kém chính xác hơn. Hãy hoàn thiện các mục còn lại để có gợi ý sát nhất.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <RecommendGateModal message={gateMessage} onClose={() => setGateMessage("")} />
        </Layout>
    );
}