import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Mail } from "lucide-react";
import { forgotPassword } from "../../services/authService";
import logo from "../../asset/logo.svg";
import "./LoginRegisterPage.css";
import { mapAuthError } from "../../utils/authErrors";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email) {
      setError("Vui lòng nhập email.");
      return;
    }
    try {
      setLoading(true);
      const res = await forgotPassword(email);
      setMessage("Yêu cầu đã được gửi. Vui lòng kiểm tra email của bạn.");
    } catch (err) {
      setError(mapAuthError(err, "Có lỗi xảy ra. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-root">
      <div className="lp-card">
        <div className="lp-left">
          <img src={logo} alt="Logo" style={{ width: "250px", height: "auto" }} />
          <h2 className="lp-headline" style={{ fontStyle: "italic", marginTop: 15, textAlign: "center" }}>
            Hỗ trợ định hướng học thuật cho sinh viên
          </h2>
          <div className="lp-copy">© 2026 SMOSP</div>
        </div>

        <div className="lp-right">
          <button className="lp-close" onClick={() => navigate("/login")} aria-label="Quay lại">✕</button>
          <div className="lp-form-box">
            <h1 className="lp-title">Quên mật khẩu</h1>
            <p style={{ marginBottom: 20, color: "var(--text-muted)", fontSize: 14 }}>
              Nhập email của bạn để nhận liên kết đặt lại mật khẩu.
            </p>

            <form className="lp-form" onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  className="field-input"
                  type="email"
                  placeholder="hovaten@gmail.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); setMessage(""); }}
                />
              </div>

              {error && <p className="field-error" style={{ background: "#fee2e2", padding: "10px", borderRadius: "8px", fontSize: "13px", color: "#b91c1c" }}>{error}</p>}
              {message && <p style={{ background: "#dcfce7", padding: "10px", borderRadius: "8px", fontSize: "13px", color: "#15803d", marginBottom: 20 }}>{message}</p>}

              <button
                type="submit"
                className={`btn btn-lg btn-primary btn-full ${loading ? "btn-loading" : ""}`}
                disabled={loading}
                style={{ marginTop: "24px" }}
              >
                {loading ? "Đang xử lý..." : <>Gửi yêu cầu <ChevronRight size={16} /></>}
              </button>
            </form>

            <p className="lp-footer-note" style={{ fontSize: 15, marginTop: "20px" }}>
              Quay lại <Link to="/login">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
