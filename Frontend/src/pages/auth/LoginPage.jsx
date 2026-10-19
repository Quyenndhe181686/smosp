import "./LoginRegisterPage.css";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import { login, googleLogin, getProfile } from "../../services/authService";
import { auth, googleProvider } from "../../config/firebase";
import { signInWithPopup } from "firebase/auth";
import logo from "../../asset/logo.svg";
import { mapAuthError, mapFirebaseError } from "../../utils/authErrors";

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const role = localStorage.getItem("role");
      if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") {
        navigate("/admin/dashboard");
      } else if (role === "ROLE_CONTENT_MANAGER") {
        navigate("/cm/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    }
  }, [navigate]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  /* Split loading states */
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleLoginSuccess = async (data, isGoogle = false) => {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("loginProvider", isGoogle ? "google" : "local");
    const role = data.roles?.length > 0 ? data.roles[0] : null;
    if (role) localStorage.setItem("role", role);
    /* Cần cho màn xử lý báo cáo lỗi: so khớp chính xác CM đang đăng nhập với
       assignedToId của báo cáo. So theo tên hiển thị không an toàn vì hai CM có
       thể trùng tên. */
    if (data.userId) localStorage.setItem("userId", data.userId);

    const defaultName = role === "ROLE_CONTENT_MANAGER"
      ? "Content Manager"
      : (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN")
        ? "Admin"
        : "Sinh viên";

    // Mật khẩu tạm: backend chặn mọi endpoint khác cho tới khi đổi mật khẩu.
    // Trước đây FE bỏ qua cờ này nên staff vào thẳng dashboard và mọi khối dữ liệu
    // lỗi 403 mà không giải thích gì (DEF_12).
    if (data.forceChangePassword) {
      localStorage.setItem("forceChangePassword", "true");
      localStorage.setItem("username", data.username || defaultName);
      navigate("/settings/password", {
        replace: true,
        state: {
          forced: true,
          notice:
            "Bạn đang dùng mật khẩu tạm do quản trị viên cấp. Hãy đổi mật khẩu trước khi sử dụng hệ thống.",
        },
      });
      return;
    }
    localStorage.removeItem("forceChangePassword");

    try {
      const profile = await getProfile();
      localStorage.setItem("username", profile.displayName || defaultName);
      localStorage.setItem("email", profile.identifier || "");
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      localStorage.setItem("username", data.username || defaultName);
    }

    if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") {
      navigate("/admin/dashboard");
    } else if (role === "ROLE_CONTENT_MANAGER") {
      navigate("/cm/dashboard");
    } else {
      navigate("/");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError("");
      setGoogleLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await googleLogin(idToken);
      handleLoginSuccess(data, true);
    } catch (err) {
      console.error("Google login error:", err);
      setError(mapFirebaseError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    try {
      setError("");
      setSubmitLoading(true);
      const data = await login(identifier, password);
      localStorage.setItem("loginProvider", "local");
      handleLoginSuccess(data, false);
    } catch (err) {
      // Không đổ nguyên văn tiếng Anh của backend ra màn (DEF_16)
      setError(mapAuthError(err, "Đăng nhập thất bại. Kiểm tra lại thông tin."));
    } finally {
      setSubmitLoading(false);
    }
  };

  const isAnyLoading = googleLoading || submitLoading;

  return (
    <div className="lp-root">
      <div className="lp-card">

        {/* ── LEFT ── */}
        <div className="lp-left">
          <img src={logo} alt="Logo" style={{ width: "250px", height: "auto" }} />

          <h2 className="lp-headline" style={{ fontStyle: "italic", marginTop: 15, textAlign: "center" }}>
            Hỗ trợ định hướng học thuật cho sinh viên
          </h2>

          <div className="lp-copy">
            © 2026 SMOSP
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="lp-right">
          <button className="lp-close" onClick={() => navigate("/")} aria-label="Đóng">✕</button>

          <div className="lp-form-box">
            <h1 className="eyebrow" style={{ marginBottom: 12 }}>Chào mừng bạn quay trở lại!</h1>


            {/* Google button */}
            <button
              className={`lp-google-btn${googleLoading ? " btn-loading" : ""}`}
              type="button"
              onClick={handleGoogleLogin}
              disabled={isAnyLoading}
            >
              {googleLoading ? (
                <span className="btn-spinner" style={{ borderColor: "#4285F4 transparent transparent transparent", marginRight: "8px" }} />
              ) : (
                <GoogleLogo />
              )}
              {googleLoading ? "Đang liên kết..." : "Đăng nhập với Google"}
            </button>

            <div className="lp-divider">Hoặc</div>

            <form className="lp-form" onSubmit={handleSubmit} noValidate>

              {/* Identifier */}
              <div className="field">
                <label className="field-label" htmlFor="login-id">
                  Email hoặc tên đăng nhập
                </label>
                <input
                  id="login-id"
                  className="field-input"
                  placeholder="user@gmail.com hoặc user123"
                  value={identifier}
                  disabled={isAnyLoading}
                  autoComplete="username"
                  onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                />
              </div>

              {/* Password */}
              <div className="field">
                <div className="lp-label-row">
                  <label className="field-label" htmlFor="login-pass">Mật khẩu</label>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-pass"
                    className={`field-input${error ? " error" : ""}`}
                    style={{ paddingRight: 44 }}
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    disabled={isAnyLoading}
                    autoComplete="current-password"
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  />
                  <button type="button"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", padding: 4, cursor: "pointer",
                      color: "var(--text-muted)", display: "flex", alignItems: "center",
                    }}>
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <Link to="/forgot-password" className="lp-forgot" style={{ fontSize: 15, display: "flex", justifyContent: "flex-end" }}>
                Quên mật khẩu?
              </Link>

              {/* Error */}
              {error && (
                <div className="field-error" role="alert"
                  style={{ background: "var(--error-light)", padding: "10px 14px", borderRadius: "var(--r-md)", fontSize: 13 }}>
                  <p>{error}</p>
                  {error.includes("chưa được kích hoạt") && (
                    <p style={{ marginTop: "6px" }}>
                      <Link to="/verify-email" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>
                        Bấm vào đây để nhận lại email xác thực
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className={`btn btn-lg btn-primary btn-full${submitLoading ? " btn-loading" : ""}`}
                disabled={isAnyLoading}>
                {submitLoading ? (
                  <><span className="btn-spinner" style={{ marginRight: "8px" }} />Đang xử lý...</>
                ) : (
                  <>Đăng nhập<ChevronRight size={16} /></>
                )}
              </button>
            </form>

            <p className="lp-footer-note" style={{ fontSize: 15 }}>
              Chưa có tài khoản sinh viên?{" "}
              <Link to="/register">Đăng ký ngay</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;