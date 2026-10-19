import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getMajors, getSpecializationsByMajor, getNarrowSpecDetail } from "../../services/catalogService";
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import "./NarrowSpecDetailPage.css";

export default function NarrowSpecDetailPage() {
  const { nsId } = useParams();
  const navigate = useNavigate();

  const [parentMajor, setParentMajor] = useState(null);
  const [parentSpec, setParentSpec] = useState(null);
  const [narrowSpecDetail, setNarrowSpecDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isLoggedIn = !!localStorage.getItem("accessToken");
  const username = localStorage.getItem("username");
  const user = isLoggedIn ? { name: username || "Người dùng" } : null;

  const [breadcrumbFailed, setBreadcrumbFailed] = useState(false);

  useEffect(() => {
    const fetchNsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch narrow spec details
        const nsDetail = await getNarrowSpecDetail(nsId);
        setNarrowSpecDetail(nsDetail);

        // Lời gọi phụ chỉ phục vụ breadcrumb: hỏng thì mất breadcrumb, KHÔNG được
        // xoá luôn nội dung chính đã tải thành công (DEF_42)
        try {
          const majors = await getMajors();
          let foundSpec = null;
          let foundMajor = null;

          for (const major of majors) {
            const specs = await getSpecializationsByMajor(major.id);
            const spec = specs.find((s) => s.id === nsDetail.specializationId);
            if (spec) {
              foundSpec = spec;
              foundMajor = major;
              break;
            }
          }

          setParentSpec(foundSpec);
          setParentMajor(foundMajor);
          setBreadcrumbFailed(false);
        } catch (breadcrumbErr) {
          console.error("Failed to resolve parent spec/major for breadcrumb:", breadcrumbErr);
          setParentSpec(null);
          setParentMajor(null);
          setBreadcrumbFailed(true);
        }
      } catch (err) {
        console.error("Error fetching narrow spec details:", err);
        setError(err.message || "Đã xảy ra lỗi khi tải thông tin chuyên ngành hẹp.");
      } finally {
        setLoading(false);
      }
    };

    if (nsId) {
      fetchNsData();
    }
  }, [nsId]);

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

  const handleRoadmapRedirect = () => {
    if (isLoggedIn) {
      const role = localStorage.getItem("role");
      if (role === "ROLE_STUDENT") {
        const targetSpecId = parentSpec?.id || narrowSpecDetail?.specializationId || "";
        const targetNsId = narrowSpecDetail?.id || nsId;
        navigate(targetSpecId && targetNsId ? `/student/roadmap/${targetSpecId}/${targetNsId}` : "/student/roadmap");
      } else {
        alert("Tính năng Lộ trình học tập chỉ dành cho Sinh viên.");
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
      <div className="ns-status-container">
        <p className="ns-status-text" style={{ color: error ? "#e0362e" : "#5b6270" }}>
          {error ? error : "Đang tải dữ liệu..."}
        </p>
        {error && (
          <button
            className="ns-status-btn"
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
        {/* ---------- Shorter Banner (No image) ---------- */}
        <section className="major-banner major-banner--no-image reveal">
          <div className="major-banner__content">
            <nav className="major-breadcrumb" aria-label="breadcrumb">
              <Link to="/catalog">Mục lục ngành</Link>
              <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
              {/* Major/Spec cha bị ẩn hoặc lời gọi breadcrumb lỗi thì vẫn giữ đủ 4 mắt,
                  chỉ chuyển mắt đó thành text không bấm được (DEF_41) */}
              {parentMajor ? (
                <>
                  <Link to={`/catalog/majors/${parentMajor.id}`}>{parentMajor.name}</Link>
                  <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
                </>
              ) : (
                <>
                  <span className="major-breadcrumb-muted" title="Khối ngành cha hiện không hiển thị công khai">Khối ngành</span>
                  <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
                </>
              )}
              {parentSpec ? (
                <>
                  <Link to={`/catalog/specializations/${parentSpec.id}`}>{parentSpec.name}</Link>
                  <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
                </>
              ) : (
                <>
                  <span className="major-breadcrumb-muted" title="Chuyên ngành cha hiện không hiển thị công khai">Chuyên ngành</span>
                  <span className="major-breadcrumb-sep" aria-hidden="true">›</span>
                </>
              )}
              <span aria-current="page">{narrowSpecDetail.name}</span>
            </nav>
            <span className="major-banner__eyebrow">Chuyên ngành hẹp</span>
            <h1 className="major-banner__title">{narrowSpecDetail.name}</h1>
            <div className="major-banner__meta">
              <span className="major-banner__code">{narrowSpecDetail.code}</span>
              {breadcrumbFailed && (
                <>
                  <span className="major-banner__dot">•</span>
                  <span>Chưa đọc được thông tin ngành/chuyên ngành cha</span>
                </>
              )}
              {parentSpec ? (
                <>
                  <span className="major-banner__dot">•</span>
                  <span>
                    Chuyên ngành:{" "}
                    <Link to={`/catalog/specializations/${parentSpec.id}`} className="ns-banner-link">
                      {parentSpec.name}
                    </Link>
                  </span>
                </>
              ) : (
                <>
                  <span className="major-banner__dot">•</span>
                  <span className="major-breadcrumb-muted" title="Chuyên ngành cha hiện không hiển thị công khai">
                    Chuyên ngành
                  </span>
                </>
              )}
              {parentMajor ? (
                <>
                  <span className="major-banner__dot">•</span>
                  <span>
                    Khối ngành:{" "}
                    <Link to={`/catalog/majors/${parentMajor.id}`} className="ns-banner-link">
                      {parentMajor.name}
                    </Link>
                  </span>
                </>
              ) : (
                <>
                  <span className="major-banner__dot">•</span>
                  <span className="major-breadcrumb-muted" title="Khối ngành cha hiện không hiển thị công khai">
                    Khối ngành
                  </span>
                </>
              )}
            </div>
            <div className="spec-roadmap-btn-container" style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button onClick={handleRoadmapRedirect} className="spec-roadmap-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "8px" }}>
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
                Xem lộ trình học tập
              </button>
              {localStorage.getItem('role') === 'ROLE_STUDENT' && (
                <button
                  type="button"
                  onClick={() => navigate('/student/content-report', {
                    state: {
                      entityType: 'NARROW_SPEC',
                      entityId: narrowSpecDetail.id,
                      pageLabel: `Chuyên ngành hẹp: ${narrowSpecDetail.name} (${narrowSpecDetail.code})`
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
          {/* ---------- Description ---------- */}
          <section className="major-section reveal">
            <div className="major-intro">
              <h2 className="major-section__heading major-section__heading--center major-section__heading--accent">
                Giới thiệu chuyên ngành hẹp
              </h2>
              <p className="major-intro__text">
                {narrowSpecDetail.description || "Chưa có thông tin mô tả chi tiết cho chuyên ngành hẹp này."}
              </p>
            </div>
          </section>


        </div>
      </div>
      <Footer />
    </div>
  );
}
