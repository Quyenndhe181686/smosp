import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { resetPassword } from "../../services/authService";
import { PasswordStrengthChecker } from "../../components/common";
import logo from "../../asset/logo.svg";
import { mapAuthError } from "../../utils/authErrors";
import "./LoginRegisterPage.css";

const PASSWORD_MAX = 128;

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // Thiếu token (link sai/cắt) khác với token đã hết hạn hoặc đã dùng — phải nói rõ
  // từng trường hợp và khoá form đúng lúc (DEF_28)
  const [tokenRejected, setTokenRejected] = useState(false);
  const missingToken = !token;
  const formLocked = missingToken || tokenRejected || !!message;

  const [confirmError, setConfirmError] = useState("");

  const isFormValid = 
    newPassword.length > 0 &&
    newPassword.length <= PASSWORD_MAX &&
    isPasswordValid &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  useEffect(() => {
    if (!token) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ: đường dẫn thiếu mã xác thực. Hãy mở lại đúng liên kết trong email hoặc yêu cầu gửi lại.");
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [token]);

  // Debounced real-time validation for confirm password (1s)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (confirmPassword && newPassword !== confirmPassword) {
        setConfirmError("Mật khẩu xác nhận không khớp.");
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [newPassword, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formLocked) return;
    setError("");
    setMessage("");
    if (!newPassword || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (newPassword.length > PASSWORD_MAX) {
      setError(`Mật khẩu mới không được vượt quá ${PASSWORD_MAX} ký tự.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!isPasswordValid) {
      setError("Mật khẩu mới phải đáp ứng tất cả các yêu cầu độ mạnh.");
      return;
    }
    try {
      setError("");
      setLoading(true);
      const res = await resetPassword(token, newPassword);
      setMessage("Đổi mật khẩu thành công!");
      timerRef.current = setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const raw = err.response?.data?.message || "";
      if (/token/i.test(raw) || err.response?.status === 400 || err.response?.status === 410) {
        setTokenRejected(true);
      }
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
          <button className="lp-close" onClick={() => navigate("/login")} aria-label="Hủy">✕</button>
          <div className="lp-form-box">
            <h1 className="lp-title">Đặt lại mật khẩu</h1>
            
            <form className="lp-form" onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="new-pass">Mật khẩu mới</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-pass"
                    className="field-input"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    disabled={formLocked}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); setMessage(""); }}
                  />
                  <button type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#666" }}>
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <PasswordStrengthChecker password={newPassword} onValidationChange={setIsPasswordValid} />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="conf-pass">Xác nhận mật khẩu</label>
                <input
                  id="conf-pass"
                  className="field-input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  disabled={formLocked}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); setMessage(""); setConfirmError(""); }}
                />
                {confirmError && <p className="field-error" style={{ color: "#b91c1c", fontSize: "12.5px", marginTop: "6px" }}>{confirmError}</p>}
              </div>

              {error && <p className="field-error" style={{ background: "#fee2e2", padding: "10px", borderRadius: "8px", fontSize: "13px", color: "#b91c1c" }}>{error}</p>}
              {message && <p style={{ background: "#dcfce7", padding: "10px", borderRadius: "8px", fontSize: "13px", color: "#15803d", marginBottom: 20 }}>{message}</p>}

              <button
                type="submit"
                className={`btn btn-lg btn-primary btn-full ${loading ? "btn-loading" : ""}`}
                disabled={loading || formLocked || !isFormValid}
              >
                {loading ? "Đang xử lý..." : <>Cập nhật mật khẩu <ChevronRight size={16} /></>}
              </button>

              {/* Token thiếu hoặc bị server từ chối: giải thích + lối ra rõ ràng (DEF_28) */}
              {(missingToken || tokenRejected) && (
                <button
                  type="button"
                  className="btn btn-lg btn-full"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate("/forgot-password")}
                >
                  Yêu cầu gửi lại liên kết đặt lại mật khẩu
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
