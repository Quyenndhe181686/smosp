import { useState, useMemo, useEffect, useRef } from 'react';
import Navbar from "../../components/common/Navbar";
import Footer from "../../components/common/Footer";
import './Majorcatalog.css';
import { Link, useNavigate } from "react-router-dom";
import { getMajors, getSpecializationsByMajor, getNarrowSpecsBySpecialization, searchCatalog } from '../../services/catalogService';

export default function Majorcatalog({
  isLoggedIn = !!localStorage.getItem("accessToken"),
  onNavigateToPortalTab,
} = {}) {
  const navigate = useNavigate();
  const openLogin = (mode = "login") => {
    navigate(mode === "register" ? "/register" : "/login");
  };

  const username = localStorage.getItem("username");
  const user = isLoggedIn ? { name: username || "Người dùng" } : null;

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
      openLogin();
    }
  };

  const [filterMajor, setFilterMajor] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpec, setActiveSpec] = useState(null); // { majorId, specId }
  const panelRef = useRef(null);

  const [catalogData, setCatalogData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchCatalog(searchQuery.trim());
        setSearchResults(res);
      } catch (err) {
        console.error("Failed to search catalog:", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCatalogData = async () => {
    try {
      setLoading(true);
      const majors = await getMajors();
      const activeMajors = majors.filter(m => m.isActive);

      const assembledTree = await Promise.all(activeMajors.map(async (major) => {
        const specializations = await getSpecializationsByMajor(major.id);
        const activeSpecs = specializations.filter(s => s.isActive);

        const specsWithNS = await Promise.all(activeSpecs.map(async (spec) => {
          const narrowSpecs = await getNarrowSpecsBySpecialization(spec.id);
          const publishedNS = narrowSpecs.filter(ns => ns.isPublished);

          return {
            id: spec.id,
            code: spec.code,
            name: spec.name,
            narrowSpecs: publishedNS.map(ns => ({
              id: ns.id,
              code: ns.code,
              name: ns.name,
            }))
          };
        }));

        return {
          id: major.id,
          code: major.code,
          name: major.name,
          color: 'var(--primary)',
          bgLight: '#FFF4EC',
          imageUrl: major.imageUrl,
          totalNarrowSpecs: specsWithNS.reduce((acc, s) => acc + s.narrowSpecs.length, 0),
          specializations: specsWithNS
        };
      }));
      setCatalogData(assembledTree);
      setLoadError(null);
    } catch (error) {
      console.error("Failed to load catalog tree:", error);
      // Lỗi tải khác hẳn "không tìm thấy kết quả" — phải báo riêng (DEF_38)
      setLoadError(error.response?.data?.message || 'Không tải được danh mục ngành học từ hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  const TOTALS = useMemo(() => ({
    majors: catalogData.length,
    specializations: catalogData.reduce((sum, m) => sum + m.specializations.length, 0),
    narrowSpecs: catalogData.reduce((sum, m) => sum + m.totalNarrowSpecs, 0),
  }), [catalogData]);

  useEffect(() => {
    if (activeSpec && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSpec]);

  const allSpecs = useMemo(() =>
    catalogData.flatMap(m =>
      m.specializations.map(s => ({ ...s, majorName: m.name }))
    ),
    [catalogData]
  );

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (q && searchResults) {
      return catalogData
        .filter(m => !filterMajor || m.id === filterMajor)
        .map(m => {
          const isMajorMatch = searchResults.majors?.some(rm => rm.id === m.id);
          return {
            ...m,
            specializations: m.specializations.filter(s => {
              if (filterSpec && s.id !== filterSpec) return false;
              const isSpecMatch = searchResults.specializations?.some(rs => rs.id === s.id);
              const isNsMatch = s.narrowSpecs.some(ns => searchResults.narrowSpecs?.some(rns => rns.id === ns.id));
              return isMajorMatch || isSpecMatch || isNsMatch;
            }),
          };
        })
        .filter(m => m.specializations.length > 0);
    }

    // Client-side fallback while waiting for server response
    return catalogData
      .filter(m => !filterMajor || m.id === filterMajor)
      .map(m => ({
        ...m,
        specializations: m.specializations.filter(s => {
          if (filterSpec && s.id !== filterSpec) return false;
          if (!q) return true;
          return (
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            s.narrowSpecs.some(ns =>
              ns.name.toLowerCase().includes(q) || ns.code.toLowerCase().includes(q)
            )
          );
        }),
      }))
      .filter(m => m.specializations.length > 0);
  }, [catalogData, filterMajor, filterSpec, searchQuery, searchResults]);

  const hasActiveFilter = filterMajor || filterSpec || searchQuery;

  const handleMajorLabelClick = (majorId) => {
    setFilterMajor(prev => (prev === majorId ? '' : majorId));
    setFilterSpec('');
    setActiveSpec(null);
  };

  const handleSpecClick = (majorId, specId) => {
    if (activeSpec?.majorId === majorId && activeSpec?.specId === specId) {
      setActiveSpec(null);
    } else {
      setActiveSpec({ majorId, specId });
    }
  };

  const clearFilters = () => {
    setFilterMajor('');
    setFilterSpec('');
    setSearchQuery('');
  };

  const getActiveSpec = (major) => {
    if (!activeSpec || activeSpec.majorId !== major.id) return null;
    return major.specializations.find(s => s.id === activeSpec.specId) ?? null;
  };

  return (
    <div className="catalog-page">
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
            href: "/",
            onClick: (e) => {
              e.preventDefault();
              navigate("/");
            }
          },
          {
            label: "Mục lục ngành",
            href: "/major-catalog",
            active: true,
            onClick: (e) => {
              e.preventDefault();
            },
          },
        ]}
        ctaLabel={isLoggedIn ? "Tổng quan" : "Đăng nhập"}
        onCtaClick={handleDashboardRedirect}
        onRegisterClick={() => openLogin("register")}
        user={user}
        onLogoClick={() => navigate("/")}
      />

      {/* ── Hero ── */}
      <section className="catalog-hero">
        <div className="catalog-hero__overlay" />
        <div className="catalog-container">
          <nav className="catalog-breadcrumb" aria-label="breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span className="breadcrumb-sep" aria-hidden="true">›</span>
            <span aria-current="page">Mục lục ngành</span>
          </nav>

          <div className="catalog-hero__body">
            <div className="catalog-hero__text">
              <h1 className="catalog-hero__title">Mục Lục Ngành</h1>
              <p className="catalog-hero__subtitle">
                Các khối ngành, chuyên ngành và chuyên ngành hẹp
                tại FPT University.
              </p>
            </div>

            <div className="catalog-hero__stats">
              <div className="hero-stat">
                <strong>{TOTALS.majors}</strong>
                <span>Khối ngành</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <strong>{TOTALS.specializations}</strong>
                <span>Chuyên ngành</span>
              </div>
              <div className="hero-stat-divider" />
              <div className="hero-stat">
                <strong>{TOTALS.narrowSpecs}</strong>
                <span>Chuyên ngành hẹp</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filter / Search bar ── */}
      <div className="catalog-filter-bar">
        <div className="catalog-container catalog-filter-bar__inner">
          <div className="filter-select-wrap">
            <label htmlFor="filter-major" className="sr-only">Lọc khối ngành</label>
            <select
              id="filter-major"
              className="filter-select"
              value={filterMajor}
              onChange={e => {
                setFilterMajor(e.target.value);
                setFilterSpec('');
                setActiveSpec(null);
              }}
            >
              <option value="">Tất cả khối ngành</option>
              {catalogData.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrap">
            <label htmlFor="filter-spec" className="sr-only">Lọc chuyên ngành</label>
            <select
              id="filter-spec"
              className="filter-select"
              value={filterSpec}
              onChange={e => {
                setFilterSpec(e.target.value);
                setActiveSpec(null);
              }}
            >
              <option value="">Tất cả chuyên ngành</option>
              {allSpecs
                .filter(s => !filterMajor || catalogData.find(m => m.id === filterMajor)
                  ?.specializations.some(ms => ms.id === s.id))
                .map(s => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
            </select>
          </div>

          <div className="filter-search-wrap">
            <svg className="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="filter-search"
              placeholder="Tìm chuyên ngành, chuyên ngành hẹp..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setActiveSpec(null); }}
              aria-label="Tìm kiếm"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          {hasActiveFilter && (
            <button className="filter-clear-all" onClick={clearFilters}>
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* ── Catalog Content ── */}
      <main className="catalog-content" id="catalog-main">
        <div className="catalog-container">
          {loading ? (
            <div className="catalog-loading">Đang tải dữ liệu...</div>
          ) : loadError ? (
            <div className="catalog-empty">
              <div className="catalog-empty__icon">⚠️</div>
              <h3>Không tải được danh mục</h3>
              <p>{loadError} Đây là lỗi hệ thống, không phải danh mục trống.</p>
              <button className="btn-outline" onClick={loadCatalogData}>Thử lại</button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="catalog-empty">
              <div className="catalog-empty__icon">🔍</div>
              <h3>Không tìm thấy kết quả</h3>
              <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
              <button className="btn-outline" onClick={clearFilters}>Xem tất cả ngành</button>
            </div>
          ) : (
            <div className="major-list">
              {filteredData.map((major, mIdx) => {
                const activeSpc = getActiveSpec(major);
                return (
                  <section
                    key={major.id}
                    className="major-section"
                    aria-label={major.name}
                    style={{ '--major-color': major.color }}
                  >
                    {/* ── Major label (blended into background) ── */}
                    {/* Bấm vào nhãn khối Ngành = lọc theo Ngành đó + reset bộ lọc
                        Chuyên ngành, đúng như FDS mô tả (DEF_40) */}
                    <div
                      className="major-label"
                      role="button"
                      tabIndex={0}
                      title={filterMajor === major.id ? 'Bấm để bỏ lọc theo ngành này' : `Bấm để chỉ xem ngành ${major.name}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleMajorLabelClick(major.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMajorLabelClick(major.id); }
                      }}
                    >

                      <span className="major-label__code">{major.code}</span>
                      <span className="major-label__name">{major.name}</span>
                      <span className="major-label__count">
                        {major.specializations.length} chuyên ngành
                      </span>

                      <button
                        className="major-label__detail-btn"
                        onClick={(e) => { e.stopPropagation(); navigate(`/catalog/majors/${major.id}`); }}
                      >
                        Chi tiết
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                          <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>

                    {/* ── Specs + narrow spec panel (right) ── */}
                    <div className="specs-area">
                      <div className="specs-row" role="list">
                        {major.specializations.map((spec, sIdx) => {
                          const isActive =
                            activeSpec?.majorId === major.id &&
                            activeSpec?.specId === spec.id;
                          return (
                            <button
                              key={spec.id}
                              role="listitem"
                              className={`spec-card${isActive ? ' spec-card--active' : ''}`}
                              onClick={() => handleSpecClick(major.id, spec.id)}
                              aria-pressed={isActive}
                              aria-expanded={isActive}
                            >
                              <span className="spec-card__index">{String(sIdx + 1).padStart(2, '0')}</span>
                              <span className="spec-card__code">{spec.code}</span>
                              <span className="spec-card__name">{spec.name}</span>
                              <span className="spec-card__count">
                                {spec.narrowSpecs.length} CN hẹp
                              </span>

                              <div className="spec-card__footer">
                                <span
                                  className="spec-card__link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/catalog/specializations/${spec.id}`);
                                  }}
                                >
                                  Chi tiết
                                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                                    <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>

                                <svg
                                  className={`spec-card__chevron${isActive ? ' spec-card__chevron--up' : ''}`}
                                  viewBox="0 0 12 8"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M1 1l5 5 5-5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* ── Narrow Spec Panel ── */}
                      {activeSpc && (
                        <div
                          className="ns-panel"
                          ref={panelRef}
                          role="region"
                          aria-label={`Chuyên ngành hẹp của ${activeSpc.name}`}
                        >
                          <div className="ns-panel__header">
                            <div className="ns-panel__header-text">
                              <span className="ns-panel__eyebrow">Chuyên ngành hẹp</span>
                              <h3 className="ns-panel__title">{activeSpc.name}</h3>
                            </div>
                            <button
                              className="ns-panel__close"
                              onClick={() => setActiveSpec(null)}
                              aria-label="Đóng"
                            >
                              <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
                                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>

                          <div className="ns-panel__grid">
                            {activeSpc.narrowSpecs.map((ns, idx) => (
                              <div
                                key={ns.id}
                                className="ns-item"
                                onClick={() => navigate(`/catalog/narrow-specs/${ns.id}`)}
                              >
                                <span className="ns-item__num">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="ns-item__body">
                                  <span className="ns-item__name">{ns.name}</span>
                                  <span className="ns-item__code">{ns.code}</span>
                                </div>
                                <svg className="ns-item__arrow" width="12" height="12" viewBox="0 0 20 20" fill="none">
                                  <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}