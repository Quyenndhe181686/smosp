import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import {
  getProfile,
  changePassword,
  logout,
} from "../../services/authService";
import { Key, Eye, EyeOff, Save, Shield, User, Mail, LogOut } from "lucide-react";
import { PasswordStrengthChecker } from "../../components/common";
import { mapAuthError } from "../../utils/authErrors";
import "./AccountPage.css";

const PASSWORD_MAX = 128;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);
  // Vào màn này do bị ép đổi mật khẩu tạm (DEF_12)
  const forcedChange =
    location.state?.forced === true || localStorage.getItem("forceChangePassword") === "true";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const isFormValid = 
    oldPassword.trim().length > 0 &&
    newPassword.length > 0 &&
    newPassword.length <= PASSWORD_MAX &&
    isPasswordValid &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword &&
    newPassword !== oldPassword;

  // Debounced real-time validation for confirm password (1s)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (confirmPassword && newPassword !== confirmPassword) {
        setConfirmError("Mật khẩu xác nhận không khớp.");
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [newPassword, confirmPassword]);

  const storedRole = localStorage.getItem("role");
  const role =
    (storedRole === "ROLE_ADMIN" || storedRole === "ROLE_SUPER_ADMIN")
      ? "admin"
      : storedRole === "ROLE_CONTENT_MANAGER"
        ? "cm"
        : "student";
  const roleLabel = { student: "Sinh viên", cm: "Content Manager", admin: "Quản trị viên" }[role];

  /* Khai báo TRƯỚC useEffect bên dưới: effect gọi tới nó ngay trong nhánh xử lý
     lỗi 401, để sau thì đó là truy cập biến trước khi khởi tạo. */
  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getProfile();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError("Không thể tải thông tin tài khoản. Vui lòng đăng nhập lại.");
        if (err.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [handleLogout]);

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    if (pwSaving || pwSuccess) return;
    // 3 điều kiện trước đây bị đẩy hết lên server vì chỉ check falsy (DEF_19)
    if (!oldPassword.trim()) {
      setPwError("Vui lòng nhập mật khẩu hiện tại (không được để trống hoặc chỉ có khoảng trắng).");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setPwError("Vui lòng điền đầy đủ thông tin mật khẩu.");
      return;
    }
    if (newPassword.length > PASSWORD_MAX) {
      setPwError(`Mật khẩu mới không được vượt quá ${PASSWORD_MAX} ký tự.`);
      return;
    }
    if (newPassword === oldPassword) {
      setPwError("Mật khẩu mới phải khác mật khẩu hiện tại.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Mật khẩu mới và mật khẩu xác nhận không khớp.");
      return;
    }
    if (!isPasswordValid) {
      setPwError("Mật khẩu mới phải đáp ứng tất cả các yêu cầu độ mạnh.");
      return;
    }
    try {
      setPwSaving(true);
      setPwError("");
      setPwSuccess("");
      await changePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      localStorage.removeItem("forceChangePassword");
      // Backend huỷ toàn bộ phiên sau khi đổi mật khẩu -> phải đưa người dùng đi
      // đăng nhập lại, không để họ ngồi lại trên màn với token đã chết (DEF_29).
      // Áp dụng cho MỌI lần đổi, không riêng lượt bị ép đổi mật khẩu tạm.
      setPwSuccess("Đổi mật khẩu thành công! Phiên đăng nhập hiện tại đã kết thúc, đang chuyển bạn sang trang đăng nhập…");
      timerRef.current = setTimeout(() => { handleLogout(); }, 2000);
    } catch (err) {
      console.error("Password change failed:", err);
      setPwError(mapAuthError(err, "Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại."));
    } finally {
      setPwSaving(false);
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
        { label: "Đổi mật khẩu" }
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
            Đổi mật khẩu
          </h1>
          <p className="account-page__subtitle">
            Cập nhật mật khẩu bảo mật tài khoản của bạn trên hệ thống SMOSP.
          </p>
          {/* Giải thích vì sao bị đưa thẳng tới đây và vì sao các màn khác chưa dùng được (DEF_12) */}
          {forcedChange && (
            <div
              className="account-forced-notice"
              style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 10,
                background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
                fontSize: 13.5, lineHeight: 1.6,
              }}
            >
              <strong>Bạn đang dùng mật khẩu tạm do quản trị viên cấp.</strong>{" "}
              {location.state?.notice ||
                "Hệ thống sẽ chặn các chức năng khác cho tới khi bạn đổi mật khẩu. Hãy đặt mật khẩu mới ngay bên dưới."}
            </div>
          )}
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
                {/* Panel 2 — Đổi mật khẩu */}
                <div className="account-panel">
                  <h2 className="account-panel__title">
                    <span className="account-panel__title-icon orange">
                      <Key size={15} />
                    </span>
                    Đổi mật khẩu
                  </h2>

                  {pwSuccess && (
                    <div className="account-alert account-alert--success" style={{ marginBottom: 20 }}>
                      {pwSuccess}
                    </div>
                  )}
                  {pwError && (
                    <div className="account-alert account-alert--error" style={{ marginBottom: 20 }}>
                      {pwError}
                    </div>
                  )}

                  {!profile?.hasPassword ? (
                    <div className="account-alert account-alert--error" style={{ margin: "20px 0", lineHeight: 1.6 }}>
                      🔒 Tài khoản của bạn đăng nhập thông qua Google SSO (Gmail), do đó không sử dụng mật khẩu trên hệ thống SMOSP và không thể thực hiện đổi mật khẩu trực tiếp tại đây.
                    </div>
                  ) : (
                    <form className="account-form" onSubmit={handlePasswordChangeSubmit}>
                      {/* Old password */}
                      <div className="account-field">
                        <label className="account-field__label">Mật khẩu cũ</label>
                        <div className="account-field__icon-wrap">
                          <span className="account-field__icon">
                            <Key size={16} />
                          </span>
                          <input
                            type={showOldPw ? "text" : "password"}
                            className="field-input"
                            style={{ paddingLeft: 40, paddingRight: 40 }}
                            placeholder="Nhập mật khẩu hiện tại"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            disabled={pwSaving || Boolean(pwSuccess)}
                          />
                          <button
                            type="button"
                            className="account-field__icon-right"
                            onClick={() => setShowOldPw(!showOldPw)}
                            tabIndex={-1}
                          >
                            {showOldPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* New password */}
                      <div className="account-field">
                        <label className="account-field__label">Mật khẩu mới</label>
                        <div className="account-field__icon-wrap">
                          <span className="account-field__icon">
                            <Key size={16} />
                          </span>
                          <input
                            type={showNewPw ? "text" : "password"}
                            className="field-input"
                            style={{ paddingLeft: 40, paddingRight: 40 }}
                            placeholder="Nhập mật khẩu mới"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={pwSaving || Boolean(pwSuccess)}
                          />
                          <button
                            type="button"
                            className="account-field__icon-right"
                            onClick={() => setShowNewPw(!showNewPw)}
                            tabIndex={-1}
                          >
                            {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <PasswordStrengthChecker password={newPassword} onValidationChange={setIsPasswordValid} />
                        <span className="account-field__helper">
                          Tối thiểu 8 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.
                        </span>
                      </div>

                      {/* Confirm password */}
                      <div className="account-field">
                        <label className="account-field__label">Xác nhận mật khẩu mới</label>
                        <div className="account-field__icon-wrap">
                          <span className="account-field__icon">
                            <Key size={16} />
                          </span>
                          <input
                            type={showConfirmPw ? "text" : "password"}
                            className="field-input"
                            style={{ paddingLeft: 40, paddingRight: 40 }}
                            placeholder="Nhập lại mật khẩu mới"
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(""); }}
                            disabled={pwSaving || Boolean(pwSuccess)}
                          />
                          <button
                            type="button"
                            className="account-field__icon-right"
                            onClick={() => setShowConfirmPw(!showConfirmPw)}
                            tabIndex={-1}
                          >
                            {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {confirmError && <p className="account-field__helper" style={{ color: "#b91c1c", marginTop: "6px" }}>{confirmError}</p>}
                      </div>

                      {/* Actions */}
                      <div className="account-form__actions">
                        <button
                          type="submit"
                          className={`btn btn-md btn-primary${pwSaving ? " btn-loading" : ""}`}
                          disabled={pwSaving || Boolean(pwSuccess) || !isFormValid}
                        >
                          {pwSaving ? (
                            <>
                              <span className="btn-spinner--primary" />
                              Đang lưu...
                            </>
                          ) : (
                            <>
                              <Save size={15} />
                              Đổi mật khẩu
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
