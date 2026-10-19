import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization, getSpecializationCourses } from "../../services/catalogService";
import { getCourses } from "../../services/courseService";
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import "./SpecDetailPage.css";

export default function SpecDetailPage() {
  const { specId } = useParams();
  const navigate = useNavigate();

  const [parentMajor, setParentMajor] = useState(null);
  const [specialization, setSpecialization] = useState(null);
  const [narrowSpecs, setNarrowSpecs] = useState([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isLoggedIn = !!localStorage.getItem("accessToken");
  const username = localStorage.getItem("username");
  const user = isLoggedIn ? { name: username || "Người dùng" } : null;

  useEffect(() => {
    const fetchSpecData = async () => {
      try {
        setLoading(true);
        setError(null);

        const majors = await getMajors();
        let foundSpec = null;
        let foundMajor = null;

        // Traverse majors to find the specialization
        for (const major of majors) {
          const specs = await getSpecializationsByMajor(major.id);
          const spec = specs.find((s) => s.id === specId);
          if (spec) {
            foundSpec = spec;
            foundMajor = major;
            break;
          }
        }

        if (!foundSpec) {
          throw new Error("Không tìm thấy chuyên ngành yêu cầu.");
        }

        setSpecialization(foundSpec);
        setParentMajor(foundMajor);

        // Fetch narrow specs in this specialization
        const nsList = await getNarrowSpecsBySpecialization(foundSpec.id);
        // Only show published narrow specs on the student view
        const publishedNs = nsList.filter((ns) => ns.isPublished);
        setNarrowSpecs(publishedNs);

        // Fetch courses to calculate total credits
        try {
          if (isLoggedIn) {
            const [specCourses, allCoursesData] = await Promise.all([
              getSpecializationCourses(foundSpec.id).catch(() => []),
              getCourses().catch(() => ({ content: [] }))
            ]);
            const coursesList = allCoursesData?.content || [];
            const coursesMap = {};
            coursesList.forEach((c) => {
              coursesMap[c.id] = c;
            });
            const sumCredits = (specCourses || []).reduce((sum, item) => {
              const matchedCourse = coursesMap[item.courseId];
              return sum + (matchedCourse?.credits || 0);
            }, 0);
            setTotalCredits(sumCredits);
          } else {
            setTotalCredits(0);
          }
        } catch (err) {
          console.error("Error calculating credits:", err);
          setTotalCredits(0);
        }
      } catch (err) {
        console.error("Error fetching specialization details:", err);
        setError(err.message || "Đã xảy ra lỗi khi tải thông tin chuyên ngành.");
      } finally {
        setLoading(false);
      }
    };

    if (specId) {
      fetchSpecData();
    }
  }, [specId]);

  // Scroll Reveal Observer
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
      { threshold: 0.05 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

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

  const handleViewNarrowSpec = (nsId) => {
    navigate(`/catalog/narrow-specs/${nsId}`);
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
      <div className="spec-status-container">
        <p className="spec-status-text" style={{ color: error ? "#e0362e" : "#5b6270" }}>
          {error ? error : "Đang tải dữ liệu..."}
        </p>
        {error && (
          <button
            className="spec-status-btn"
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
        {/* ---------- Hero Banner ---------- */}
        <section className="major-banner reveal">
          <div className="major-banner__image-wrap">
            {specialization.imageUrl ? (
              <img src={specialization.imageUrl} alt={specialization.name} className="major-banner__image" />
            ) : (
              <div className="major-banner__image-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
          <div className="major-banner__overlay" />

          <div className="major-banner__content">
            <nav className="major-breadcrumb" aria-label="breadcrumb">
              <Link to="/catalog">Mục lục ngành</Link>
              <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
              {parentMajor && (
                <>
                  <Link to={`/catalog/majors/${parentMajor.id}`}>{parentMajor.name}</Link>
                  <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
                </>
              )}
              <span aria-current="page">{specialization.name}</span>
            </nav>
            <span className="major-banner__eyebrow">Chuyên ngành</span>
            <h1 className="major-banner__title">{specialization.name}</h1>
            <div className="major-banner__meta">
              <span className="major-banner__code">{specialization.code}</span>
              <span className="major-banner__dot">•</span>
              <span>
                Khối ngành:{" "}
                <Link to={`/catalog/majors/${parentMajor.id}`} className="major-banner-link">
                  {parentMajor.name}
                </Link>
              </span>
              <span className="major-banner__dot">•</span>
              <span>Tổng số chuyên ngành hẹp: {narrowSpecs.length}</span>
              <span className="major-banner__dot">•</span>
              <span>Tổng số tín chỉ: {totalCredits}</span>
            </div>
            <div className="spec-roadmap-btn-container" style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {localStorage.getItem('role') === 'ROLE_STUDENT' && (
                <button
                  type="button"
                  onClick={() => navigate('/student/content-report', {
                    state: {
                      entityType: 'SPECIALIZATION',
                      entityId: specialization.id,
                      pageLabel: `Chuyên ngành: ${specialization.name} (${specialization.code})`
                    }
                  })}
                  className="spec-report-btn"
                  title="Báo cáo lỗi nội dung trang này"
                >
                  ⚠️ Báo lỗi nội dung
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ---------- Main Content ---------- */}
        <div className="major-content">
          {/* ---------- Giới thiệu ngành ---------- */}
          <section className="major-section reveal">
            <div className="major-intro">
              <h2 className="major-section__heading major-section__heading--center major-section__heading--accent">
                Giới thiệu ngành
              </h2>
              <p className="major-intro__text">
                {specialization.description || "Chưa có mô tả giới thiệu chi tiết cho chuyên ngành này."}
              </p>
            </div>
          </section>

          {/* ---------- Các chuyên ngành hẹp ---------- */}
          <section className="major-section reveal">
            <div className="major-specs__heading">
              <h2 className="major-section__heading major-section__heading--center major-section__heading--accent">
                Các chuyên ngành hẹp
              </h2>
              <p className="major-specs__subheading">Thuộc chuyên ngành {specialization.name}</p>
            </div>

            <div className="major-spec-grid">
              {narrowSpecs.map((ns, i) => (
                <button
                  key={ns.id}
                  type="button"
                  className="major-spec-card reveal"
                  style={{ transitionDelay: `${Math.min(i, 6) * 90}ms` }}
                  onClick={() => handleViewNarrowSpec(ns.id)}
                >
                  <span className="major-spec-card__index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="major-spec-card__code">{ns.code}</span>
                  <h3 className="major-spec-card__name">{ns.name}</h3>
                  <span className="major-spec-card__link">
                    Xem chi tiết
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ))}

              {narrowSpecs.length === 0 && (
                <p className="major-spec-grid__empty">
                  Chuyên ngành này chưa có chuyên ngành hẹp nào được công bố.
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
