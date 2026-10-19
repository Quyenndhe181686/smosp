import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import {
  getProfile,
  updateProfilePreferences,
  logout,
} from "../../services/authService";
import { User, Bell, Shield, Save, RefreshCw, Mail, LogOut } from "lucide-react";
import "./AccountPage.css";
import { mapAuthError } from "../../utils/authErrors";

export default function AccountPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const storedRole = localStorage.getItem("role");
  const role =
    (storedRole === "ROLE_ADMIN" || storedRole === "ROLE_SUPER_ADMIN")
      ? "admin"
      : storedRole === "ROLE_CONTENT_MANAGER"
        ? "cm"
        : "student";
  const roleLabel = { student: "Sinh viên", cm: "Content Manager", admin: "Quản trị viên" }[role];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getProfile();
        setProfile(data);
        setDisplayName(data.displayName || "");
        setNotifEnabled(data.notifEnabled ?? true);
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError("Không thể tải thông tin tài khoản. Vui lòng đăng nhập lại.");
        if (err.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Họ và tên không được để trống.");
      return;
    }
    if (displayName.trim().length > 100) {
      setError("Họ và tên không được vượt quá 100 ký tự.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const updated = await updateProfilePreferences(displayName, notifEnabled);
      setProfile(updated);
      setDisplayName(updated.displayName || "");
      setNotifEnabled(updated.notifEnabled ?? true);
      localStorage.setItem("username", updated.displayName);
      setSuccess("Cập nhật thông tin tài khoản thành công!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(mapAuthError(err, "Đã xảy ra lỗi khi cập nhật thông tin."));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPreferences = () => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setNotifEnabled(profile.notifEnabled ?? true);
      setError("");
      setSuccess("");
    }
  };

  const avatarLetter = profile?.displayName
    ? profile.displayName.charAt(0).toUpperCase()
    : "?";

  return (
    <Layout
      role={role}
      user={{ name: profile?.displayName || localStorage.getItem("username") || "Người dùng" }}
      breadcrumbs={[
        { label: "Trang chủ", href: "/" },
        { label: "Thiết lập tài khoản" }
      ]}
      onLogout={handleLogout}
      onLogoClick={() => {
        if (role === "admin") navigate("/admin/dashboard");
        else if (role === "cm") navigate("/cm/dashboard");
        else navigate("/student/dashboard");
      }}
      onGoHome={() => navigate("/")}
    >
      <div className="account-page">
        {/* Header */}
        <div className="account-page__header">
          <div className="eyebrow">Cài đặt</div>
          <h1 className="account-page__title" style={{ marginTop: 10 }}>
            Thiết lập tài khoản
          </h1>
          <p className="account-page__subtitle">
            Cập nhật thông tin cá nhân hiển thị của bạn trên hệ thống SMOSP.
          </p>
        </div>

        {/* Grid */}
        <div className="account-page__grid">
          {loading ? (
            <div className="account-loading">
              <div className="account-loading__spinner" />
              <p className="account-loading__text">Đang tải thông tin tài khoản...</p>
            </div>
          ) : error && !profile ? (
            <div className="account-error-state">
              <p className="account-error-state__msg">{error}</p>
              <button className="btn btn-md btn-primary" onClick={handleLogout}>
                Đăng nhập lại
              </button>
            </div>
          ) : (
            <>
              {/* ── Sidebar ── */}
              <aside className="account-sidebar">
                <div className="account-sidebar__avatar">{avatarLetter}</div>
                <div>
                  <p className="account-sidebar__name">
                    {profile.displayName}
                  </p>
                  <span className={`account-sidebar__role role-${role}`}>{roleLabel}</span>
                </div>

                <hr className="account-sidebar__divider" />

                <div className="account-sidebar__meta">
                  <div className="account-sidebar__meta-item">
                    <div className="account-sidebar__meta-icon">
                      <Shield size={15} />
                    </div>
                    <div>
                      <div className="account-sidebar__meta-label">Vai trò</div>
                      <div className="account-sidebar__meta-value">{roleLabel}</div>
                    </div>
                  </div>

                  {role === "student" ? (
                    <div className="account-sidebar__meta-item">
                      <div className="account-sidebar__meta-icon">
                        <Mail size={15} />
                      </div>
                      <div>
                        <div className="account-sidebar__meta-label">Email</div>
                        <div className="account-sidebar__meta-value">{profile.identifier}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="account-sidebar__meta-item">
                      <div className="account-sidebar__meta-icon">
                        <User size={15} />
                      </div>
                      <div>
                        <div className="account-sidebar__meta-label">Tên đăng nhập</div>
                        <div className="account-sidebar__meta-value">{profile.identifier}</div>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="account-sidebar__divider" style={{ margin: "16px 0" }} />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleLogout}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--error)" }}
                >
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </aside>

              {/* ── Right panels ── */}
              <div className="account-panels">
                {/* Panel 1 — Chi tiết tài khoản */}
                <div className="account-panel">
                  <h2 className="account-panel__title">
                    <span className="account-panel__title-icon">
                      <User size={15} />
                    </span>
                    Chi tiết tài khoản
                  </h2>

                  {success && (
                    <div className="account-alert account-alert--success" style={{ marginBottom: 20 }}>
                      {success}
                    </div>
                  )}
                  {error && (
                    <div className="account-alert account-alert--error" style={{ marginBottom: 20 }}>
                      {error}
                    </div>
                  )}

                  <form className="account-form" onSubmit={handleSavePreferences}>
                    {/* Display name */}
                    <div className="account-field">
                      <label className="account-field__label">Tên hiển thị</label>
                      <div className="account-field__icon-wrap">
                        <span className="account-field__icon">
                          <User size={16} />
                        </span>
                        <input
                          type="text"
                          className="field-input"
                          style={{ paddingLeft: 40 }}
                          placeholder="Nhập tên hiển thị"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          disabled={saving}
                          maxLength={100}
                        />
                      </div>
                    </div>

                    {/* Notification toggle */}
                    <div className="account-field">
                      <label className="account-field__label">Tùy chọn hệ thống</label>
                      <div className="account-toggle-row">
                        <div className="account-toggle-row__left">
                          <div className="account-toggle-row__icon">
                            <Bell size={16} />
                          </div>
                          <div>
                            <div className="account-toggle-row__title">
                              Nhận thông báo qua email
                            </div>
                            <div className="account-toggle-row__desc">
                              Nhận tin tức cập nhật định hướng và lộ trình học tập.
                            </div>
                          </div>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={notifEnabled}
                            onChange={(e) => setNotifEnabled(e.target.checked)}
                            disabled={saving}
                          />
                          <span className="toggle-switch__track" />
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="account-form__actions">
                      <button
                        type="submit"
                        className={`btn btn-md btn-primary${saving ? " btn-loading" : ""}`}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <span className="btn-spinner--primary" />
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <Save size={15} />
                            Lưu thay đổi
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-md btn-secondary"
                        onClick={handleResetPreferences}
                        disabled={saving}
                      >
                        <RefreshCw size={15} />
                        Đặt lại
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}