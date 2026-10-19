import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization } from "../../services/catalogService";
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import "./MajorDetailPage.css";



export default function MajorDetailPage() {
    const { majorId } = useParams();
    const navigate = useNavigate();

    const [major, setMajor] = useState(null);
    const [specializations, setSpecializations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isLoggedIn = !!localStorage.getItem("accessToken");
    const username = localStorage.getItem("username");
    const user = isLoggedIn ? { name: username || "Người dùng" } : null;

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const majors = await getMajors();
                const foundMajor = majors.find(
                    (m) => m.id === majorId || m.code.toLowerCase() === majorId.toLowerCase()
                );

                if (!foundMajor) {
                    throw new Error("Không tìm thấy khối ngành yêu cầu.");
                }

                setMajor(foundMajor);

                const specs = await getSpecializationsByMajor(foundMajor.id);

                const specsWithCount = await Promise.all(
                    specs.map(async (spec) => {
                        try {
                            const narrowSpecs = await getNarrowSpecsBySpecialization(spec.id);
                            const publishedCount = narrowSpecs.filter(ns => ns.isPublished).length;
                            return { ...spec, narrow_spec_count: publishedCount };
                        } catch (err) {
                            return { ...spec, narrow_spec_count: 0 };
                        }
                    })
                );

                setSpecializations(specsWithCount);
            } catch (err) {
                console.error("Error fetching major details:", err);
                setError(err.message || "Đã xảy ra lỗi khi tải thông tin khối ngành.");
            } finally {
                setLoading(false);
            }
        };

        if (majorId) {
            fetchData();
        }
    }, [majorId]);

    // Scroll Reveal Observer — applies to the section-level reveals AND each
    // individual spec card (staggered via transition-delay set inline below).
    useEffect(() => {
        if (loading) return;
        const els = document.querySelectorAll(".reveal");
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add("revealed");
                        observer.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.08 }
        );
        els.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [loading, specializations]);

    const handleViewSpecDetail = (specId) => {
        navigate(`/catalog/specializations/${specId}`);
    };

    const handleDashboardRedirect = () => {
        if (isLoggedIn) {
            const role = localStorage.getItem("role");
            if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") {
                navigate("/admin/dashboard");
            } else if (role === "ROLE_CONTENT_MANAGER") {
                navigate("/cm/dashboard");
            } else if (role === "ROLE_STUDENT") {
                navigate("/student/dashboard");
            } else {
                navigate("/");
            }
        } else {
            navigate("/login");
        }
    };

    const navigationLinks = [
        {
            label: "Tổng quan",
            href: "#",
            onClick: (e) => {
                e.preventDefault();
                handleDashboardRedirect();
            }
        },
        {
            label: "Trang chủ",
            href: "/",
            onClick: (e) => {
                e.preventDefault();
                navigate("/");
            }
        },
        {
            label: "Mục lục ngành",
            href: "/catalog",
            active: true,
            onClick: (e) => {
                e.preventDefault();
                navigate("/catalog");
            }
        }
    ].filter(Boolean);

    if (loading || error) {
        const statusEl = (
            <div className="major-page-container" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "450px", gap: "16px" }}>
                <p style={{ fontSize: "16px", fontWeight: "600", color: error ? "#e0362e" : "#5b6270" }}>
                    {error ? error : "Đang tải dữ liệu..."}
                </p>
                {error && (
                    <button
                        style={{
                            padding: "10px 20px",
                            background: "#f37021",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "700"
                        }}
                        onClick={() => navigate("/catalog")}
                    >
                        Quay lại mục lục ngành
                    </button>
                )}
            </div>
        );

        return (
            <div className="catalog-page">
                <Navbar
                    links={navigationLinks}
                    ctaLabel={isLoggedIn ? "Tổng quan" : "Đăng nhập"}
                    onCtaClick={handleDashboardRedirect}
                    onRegisterClick={() => navigate("/register")}
                    user={user}
                    onLogoClick={() => navigate("/")}
                />
                {statusEl}
                <Footer />
            </div>
        );
    }

    return (
        <div className="catalog-page">
            <Navbar
                links={navigationLinks}
                ctaLabel={isLoggedIn ? "Tổng quan" : "Đăng nhập"}
                onCtaClick={handleDashboardRedirect}
                onRegisterClick={() => navigate("/register")}
                user={user}
                onLogoClick={() => navigate("/")}
            />

            <div className="major-page-container">
                {/* ---------- Hero Banner (unchanged: title + image) ---------- */}
                <section className="major-banner reveal">
                    <div className="major-banner__image-wrap">
                        {major.imageUrl ? (
                            <img src={major.imageUrl} alt={major.name} className="major-banner__image" />
                        ) : (
                            <div className="major-banner__image-placeholder">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                                    <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                                    <circle cx="8" cy="8.5" r="1.6" fill="currentColor" />
                                </svg>
                            </div>
                        )}
                    </div>
                    <div className="major-banner__overlay" />

                    <div className="major-banner__content">
                        <nav className="major-breadcrumb" aria-label="breadcrumb">
                            <Link to="/catalog">Mục lục ngành</Link>
                            <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
                            <span aria-current="page">{major.name}</span>
                        </nav>
                        <span className="major-banner__eyebrow">Khối ngành</span>
                        <h1 className="major-banner__title">{major.name}</h1>

                        <div className="major-banner__meta">
                            <span className="major-banner__code">{major.code}</span>
                            <span className="major-banner__dot">•</span>
                            <span>{specializations.length} chuyên ngành</span>
                        </div>
                        {localStorage.getItem('role') === 'ROLE_STUDENT' && (
                            <button
                                type="button"
                                onClick={() => navigate('/student/content-report', {
                                    state: {
                                        entityType: 'MAJOR',
                                        entityId: major.id,
                                        pageLabel: `Ngành học: ${major.name} (${major.code})`
                                    }
                                })}
                                className="major-report-btn"
                                title="Báo cáo lỗi nội dung trang này"
                            >
                                ⚠️ Báo lỗi nội dung
                            </button>
                        )}
                    </div>
                </section>

                {/* ---------- Main Content ---------- */}
                <div className="major-content">
                    {/* ---------- Giới thiệu ngành: heading + description, both centered, orange heading ---------- */}
                    <section className="major-section reveal">
                        <div className="major-intro">
                            <h2 className="major-section__heading major-section__heading--center major-section__heading--accent">
                                Giới thiệu ngành
                            </h2>
                            <p className="major-intro__text">
                                {major.description || "Chưa có mô tả giới thiệu chi tiết cho khối ngành này."}
                            </p>
                        </div>
                    </section>

                    {/* ---------- Các chuyên ngành: centered heading, modern borderless cards, staggered reveal ---------- */}
                    <section className="major-section reveal">
                        <div className="major-specs__heading">
                            <h2 className="major-section__heading major-section__heading--center major-section__heading--accent">
                                Các chuyên ngành
                            </h2>
                            <p className="major-specs__subheading">Thuộc khối ngành {major.name}</p>
                        </div>

                        <div className="major-spec-grid">
                            {specializations.map((spec, i) => (
                                <button
                                    key={spec.id}
                                    type="button"
                                    className="major-spec-card reveal"
                                    style={{ transitionDelay: `${Math.min(i, 6) * 90}ms` }}
                                    onClick={() => handleViewSpecDetail(spec.id)}
                                >
                                    <span className="major-spec-card__index">{String(i + 1).padStart(2, "0")}</span>
                                    <span className="major-spec-card__code">{spec.code}</span>
                                    <h3 className="major-spec-card__name">{spec.name}</h3>
                                    {!!spec.narrow_spec_count && (
                                        <span className="major-spec-card__count">
                                            {spec.narrow_spec_count} chuyên ngành hẹp
                                        </span>
                                    )}
                                    <span className="major-spec-card__link">
                                        Xem chi tiết
                                        <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                                            <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                </button>
                            ))}

                            {specializations.length === 0 && (
                                <p className="major-spec-grid__empty">
                                    Khối ngành này chưa có chuyên ngành nào được công bố.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
            <Footer />
        </div>
    );
}