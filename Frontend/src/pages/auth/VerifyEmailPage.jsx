import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { verifyEmail, resendVerifyEmail } from "../../services/authService";
import logo from "../../asset/logo.svg";
import "./LoginRegisterPage.css";
import { mapAuthError } from "../../utils/authErrors";
import { Mail, RefreshCw } from "lucide-react";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState(token ? "verifying" : "idle"); // idle, verifying, success, error
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState(""); // loading, success, error
  const [resendMsg, setResendMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let timerId = null;
    const doVerify = async () => {
      if (!token) {
        setStatus("idle");
        return;
      }
      try {
        const res = await verifyEmail(token);
        setStatus("success");
        setMessage("Xác thực email thành công! Bạn có thể đăng nhập ngay bây giờ.");
        timerId = setTimeout(() => navigate("/login"), 5000);
      } catch (err) {
        setStatus("error");
        setMessage(mapAuthError(err, "Xác thực thất bại hoặc liên kết đã hết hạn."));
      }
    };
    doVerify();
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [token, navigate]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setResendMsg("Vui lòng nhập địa chỉ email.");
      setResendStatus("error");
      return;
    }
    try {
      setResendStatus("loading");
      setResendMsg("");
      const res = await resendVerifyEmail(resendEmail.trim());
      setResendStatus("success");
      setResendMsg("Đã gửi email xác thực mới! Vui lòng kiểm tra hộp thư của bạn.");
    } catch (err) {
      setResendStatus("error");
      setResendMsg(mapAuthError(err, "Không thể gửi lại email xác thực. Vui lòng thử lại sau."));
    }
  };

  return (
    <div className="lp-root">
      <div className="lp-card" style={{ maxWidth: "520px", minHeight: "auto", padding: "40px" }}>
        <div style={{ textAlign: "center", width: "100%" }}>
          <img src={logo} alt="Logo" style={{ width: "150px", marginBottom: "20px" }} />
          <h1 className="lp-title" style={{ fontSize: "24px", marginBottom: "16px" }}>Xác thực Email</h1>
          
          {status === "verifying" && (
            <div style={{ padding: "20px", color: "var(--text-secondary)" }}>
              <p>Đang tiến hành xác thực tài khoản của bạn...</p>
            </div>
          )}
          
          {status === "success" && (
            <div style={{ color: "#15803d", background: "#dcfce7", padding: "20px", borderRadius: "8px", textAlign: "left" }}>
              <p style={{ fontWeight: 600 }}>{message}</p>
              <p style={{ fontSize: "13px", marginTop: "10px" }}>Hệ thống sẽ tự động chuyển hướng về trang đăng nhập sau vài giây...</p>
              <button 
                onClick={() => navigate("/login")}
                className="btn btn-lg btn-primary btn-full"
                style={{ marginTop: "16px" }}
              >
                Đăng nhập ngay
              </button>
            </div>
          )}
          
          {(status === "error" || status === "idle") && (
            <div>
              {status === "error" && (
                <div style={{ color: "#b91c1c", background: "#fee2e2", padding: "16px", borderRadius: "8px", marginBottom: "24px", textAlign: "left", fontSize: "14px" }}>
                  {message}
                </div>
              )}

              <div style={{ background: "var(--bg, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", padding: "20px", borderRadius: "8px", textAlign: "left" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Mail size={18} /> Gửi lại liên kết xác thực
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary, #64748b)", marginBottom: "16px" }}>
                  Nếu liên kết xác thực đã hết hạn hoặc bạn chưa nhận được email, hãy nhập email để nhận mã xác thực mới.
                </p>

                <form onSubmit={handleResend}>
                  <div className="field" style={{ marginBottom: "12px" }}>
                    <input
                      className="field-input"
                      type="email"
                      placeholder="Nhập email của bạn (vd: student@fpt.edu.vn)"
                      value={resendEmail}
                      onChange={(e) => {
                        setResendEmail(e.target.value);
                        setResendMsg("");
                      }}
                      disabled={resendStatus === "loading"}
                    />
                  </div>

                  {resendMsg && (
                    <p style={{ 
                      fontSize: "13px", 
                      padding: "10px", 
                      borderRadius: "6px", 
                      marginBottom: "12px",
                      color: resendStatus === "success" ? "#15803d" : "#b91c1c",
                      background: resendStatus === "success" ? "#dcfce7" : "#fee2e2"
                    }}>
                      {resendMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-lg btn-primary btn-full"
                    disabled={resendStatus === "loading"}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "24px" }}
                  >
                    {resendStatus === "loading" ? (
                      <>Đang gửi...</>
                    ) : (
                      <><RefreshCw size={16} /> Gửi lại email xác thực</>
                    )}
                  </button>
                </form>
              </div>

              <div style={{ marginTop: "24px" }}>
                <Link to="/login" style={{ color: "var(--accent, #0057d9)", fontSize: "14px", textDecoration: "none", fontWeight: 500 }}>
                  ← Quay lại trang Đăng nhập
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;

