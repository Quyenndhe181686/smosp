import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Compass, ArrowRight, BrainCircuit, Sparkles,
  Fingerprint, TrendingUp, DollarSign,
  ArrowLeft, ChevronRight, Award, Layers,
  GraduationCap, GitCompare, Check, AlertTriangle,
  BookOpen, BarChart2, Zap
} from "lucide-react";
import Navbar from "../components/common/Navbar.jsx";
import Footer from "../components/common/Footer.jsx";
import "./Homepage.css";
import Majorcatalog from "./guest/Majorcatalog.jsx";
import bgImg from "../asset/background.jpg";
import khaibaoImg from "../asset/khaibao.png";
import rcmResultImg from "../asset/rcmresult.png";
import roadmapImg from "../asset/roadmap.png";
import logoNoText from "../asset/logo-no-text.svg";

/* =========================================================
   SCROLL REVEAL HOOK
   Adds class "revealed" to any element with class "reveal"
   when it enters the viewport.
   ========================================================= */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            observer.unobserve(e.target); // fire once
          }
        });
      },
      { threshold: 0.14 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* =========================================================
   STAT PILL — hero stats row
   ========================================================= */
function StatPill({ icon: Icon, label, highlight }) {
  return (
    <div className="hp-stat-pill">
      <Icon className="icon-sm c-orange" />
      {highlight && <span className="hp-stat-pill-num">{highlight}</span>}
      <span>{label}</span>
    </div>
  );
}

/* =========================================================
   MAIN PAGE COMPONENT
   ========================================================= */
export default function Home({
  isLoggedIn,
  onStart,
  onLoginSuccess,
  onNavigateToCatalog,
  onNavigateToPortalTab,
  onLogout,
  registeredStudent,
  initialIntroTab = "none",
}) {
  const navigate = useNavigate();
  const [activeIntroTab, setActiveIntroTab] = useState(
    initialIntroTab === "none" ? "none" : initialIntroTab
  );

  const token = localStorage.getItem("accessToken");
  const actualIsLoggedIn = isLoggedIn !== undefined ? isLoggedIn : !!token;
  const username = localStorage.getItem("username");
  const user = actualIsLoggedIn ? { name: username || "Người dùng" } : null;

  /* Activate scroll reveal */
  useScrollReveal();

  useEffect(() => {
    setActiveIntroTab(initialIntroTab === "none" ? "none" : initialIntroTab);
  }, [initialIntroTab]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (actualIsLoggedIn && role) {
      if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") {
        navigate("/admin/dashboard", { replace: true });
      } else if (role === "ROLE_CONTENT_MANAGER") {
        navigate("/cm/dashboard", { replace: true });
      }
    }
  }, [actualIsLoggedIn, navigate]);

  const openLogin = (mode = "login") => {
    navigate(mode === "register" ? "/register" : "/login");
  };

  const jumpTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDashboardRedirect = () => {
    if (actualIsLoggedIn) {
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
      openLogin();
    }
  };

  const gotoFeature = (tab) => {
    if (actualIsLoggedIn) {
      const role = localStorage.getItem("role");
      if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") {
        navigate("/admin/dashboard");
      } else if (role === "ROLE_CONTENT_MANAGER") {
        navigate("/cm/dashboard");
      } else {
        if (tab === "profile") {
          navigate("/student/profile");
        } else if (tab === "specialization-recommendations") {
          navigate("/student/recommendation");
        } else if (tab === "roadmap") {
          navigate("/student/roadmap");
        } else if (tab === "comparison") {
          navigate("/student/transfer");
        } else {
          navigate("/student/dashboard");
        }
      }
    } else {
      openLogin("login");
    }
  };

  return (
    <div className="hp-page">

      {/* ── Navbar ── */}
      <Navbar
        links={[
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
            href: "#",
            active: true,
            onClick: (e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          },

          {
            label: "Mục lục ngành",
            href: "#",
            onClick: (e) => {
              e.preventDefault();
              navigate("/major-catalog");
            },
          },
        ]}
        ctaLabel={actualIsLoggedIn ? "Tổng quan" : "Đăng nhập"}
        onCtaClick={handleDashboardRedirect}
        onRegisterClick={() => openLogin("register")}
        user={user}
        onLogoClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <div className="hp-main">

        {/* ── HERO ── */}
        <section className="hp-hero">
          <div className="hp-hero-bg-overlay" style={{ backgroundImage: `url(${bgImg})` }} />
          <div className="hp-hero-blob hp-hero-blob-1" />
          <div className="hp-hero-blob hp-hero-blob-2" />
          <div className="hp-hero-inner">
            <h1 className="hp-hero-title">
              <span className="hp-hero-title-brand">
                SM
                <img src={logoNoText} alt="O" className="hp-hero-logo-o" />
                SP
              </span>
            </h1>
            <p className="hp-hero-subtitle">
              Tư vấn, hỗ trợ sinh viên Đại học FPT xác định chuyên ngành hẹp phù hợp.
            </p>
            <div className="hp-hero-actions">
              <button
                onClick={() => jumpTo("profile-declaration")}
                className="btn btn-lg btn-primary"
              >
                khám phá
                <ArrowRight className="icon-sm" />
              </button>
              {!actualIsLoggedIn ? (
                <button
                  onClick={() => openLogin("register")}
                  className="btn btn-lg btn-ghost-blue"
                >
                  <Sparkles className="icon-sm c-orange" />
                  Đăng ký
                </button>
              ) : (
                <button
                  onClick={handleDashboardRedirect}
                  className="btn btn-lg btn-ghost-blue"
                >
                  Tổng quan
                </button>
              )}
            </div>

          </div>
        </section>

        {/* ── FEATURE 01: Khai báo Hồ sơ Sinh viên ── */}
        <section id="profile-declaration" className="hp-section hp-section-bg">
          <div className="container">
            <div className="hp-feature-grid">

              <div className="hp-feature-content reveal">
                <div className="hp-feature-number hp-num-orange">01</div>
                <h2 className="hp-feature-title">Khai báo Hồ sơ &amp; Học thuật</h2>
                <p className="hp-feature-body">
                  Cung cấp đầy đủ thông tin cá nhân, tải bảng điểm từ cổng FAP, khai báo các kỹ năng hiện có
                  và sở thích nghề nghiệp để hệ thống tự động phân tích và đưa ra tư vấn chính xác nhất.
                </p>
                <div className="hp-feature-inset-alt">
                  Đồng bộ bảng điểm FAP, bổ sung kỹ năng cá nhân &amp; sở thích nghề nghiệp nhằm xây dựng dữ liệu đầu vào chuẩn xác nhất cho thuật toán gợi ý.
                </div>
                <div className="hp-feature-actions">
                  <button
                    onClick={() => gotoFeature("profile")}
                    className="btn btn-md btn-primary"
                  >
                    Khai báo ngay <ChevronRight className="icon-sm" />
                  </button>
                </div>
              </div>

              <div className="hp-feature-illustration reveal">
                <img src={khaibaoImg} alt="Khai báo hồ sơ sinh viên" className="hp-feature-img" />
              </div>

            </div>
          </div>
        </section>

        {/* ── FEATURE 02: Gợi ý chuyên ngành hẹp ── */}
        <section id="specialization-recommendations" className="hp-section hp-section-alt">
          <div className="container">
            <div className="hp-feature-grid hp-feature-grid-rev">

              <div className="hp-feature-content reveal">
                <div className="hp-feature-number hp-num-blue">02</div>
                <h2 className="hp-feature-title">Gợi ý Chuyên ngành Hẹp</h2>
                <p className="hp-feature-body">
                  Tìm kiếm hướng đi sâu hẹp tối ưu nhất dựa trên sở thích, kỹ năng, kết quả học thuật GPA
                  từ cổng FAP và sự ảnh hưởng của thị trường lao động.
                </p>
                <div className="hp-feature-inset">
                  Phân tích hồ sơ học thuật, sở thích, kỹ năng, dữ liệu thị trường, sắp xếp chuyên ngành hẹp theo độ phù hợp
                </div>
                <div className="hp-feature-actions">
                  <button
                    onClick={() => gotoFeature("specialization-recommendations")}
                    className="btn btn-md btn-blue"
                  >
                    Khám phá ngay <ChevronRight className="icon-sm" />
                  </button>
                </div>
              </div>

              <div className="hp-feature-illustration reveal">
                <img src={rcmResultImg} alt="Gợi ý chuyên ngành hẹp" className="hp-feature-img" />
              </div>

            </div>
          </div>
        </section>

        {/* ── FEATURE 03: Academic Roadmap ── */}
        <section id="roadmap" className="hp-section hp-section-bg">
          <div className="container">
            <div className="hp-feature-grid">

              <div className="hp-feature-content reveal">
                <div className="hp-feature-number hp-num-indigo">03</div>
                <h2 className="hp-feature-title">Lộ trình học tập cá Nhân</h2>
                <p className="hp-feature-body">
                  Theo dõi lộ trình học tập của bạn ngay tại SMOSP với khung chương trình của các chuyên ngành hẹp tại đại học FPT
                </p>
                <div className="hp-feature-inset-alt">
                  Đồng bộ hóa với bảng điểm cá nhân, ghi chú, môn học ưa thích và điều chỉnh, sắp xếp lộ trình
                </div>
                <div className="hp-feature-actions">
                  <button
                    onClick={() => gotoFeature("roadmap")}
                    className="btn btn-md btn-primary"
                  >
                    Xem lộ trình chi tiết <ChevronRight className="icon-sm" />
                  </button>
                </div>
              </div>
              <div className="hp-feature-illustration reveal">
                <img src={roadmapImg} alt="Lộ trình học tập cá nhân" className="hp-feature-img" />
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ── Footer ── */}
      <Footer />

    </div>
  );
}