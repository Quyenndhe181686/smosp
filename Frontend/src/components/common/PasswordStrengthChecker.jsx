import React, { useEffect } from "react";

const criteriaList = [
  { id: "length", label: "tối thiểu 8 ký tự", check: (val) => val.length >= 8 },
  { id: "uppercase", label: "chữ hoa", check: (val) => /[A-Z]/.test(val) },
  { id: "lowercase", label: "chữ thường", check: (val) => /[a-z]/.test(val) },
  { id: "number", label: "chữ số", check: (val) => /\d/.test(val) },
  { id: "special", label: "ký tự đặc biệt", check: (val) => /[^A-Za-z0-9]/.test(val) },
];

export default function PasswordStrengthChecker({ password = "", onValidationChange }) {
  const hasInput = password.length > 0;

  // Evaluate which criteria are met
  const metCriteria = criteriaList.filter((c) => c.check(password));
  const missingCriteria = criteriaList.filter((c) => !c.check(password));
  const score = hasInput ? metCriteria.length : 0;

  // Determine strength label, color, and bar width percentage
  let strengthLabel = "";
  let strengthColor = "transparent";
  let barWidth = "0%";

  if (hasInput) {
    if (score <= 2) {
      strengthLabel = "Yếu";
      strengthColor = "#ef4444"; // Red
      barWidth = score === 1 ? "20%" : "40%";
    } else if (score <= 4) {
      strengthLabel = "Trung bình";
      strengthColor = "#f97316"; // Orange
      barWidth = score === 3 ? "60%" : "80%";
    } else {
      strengthLabel = "Mạnh";
      strengthColor = "#22c55e"; // Green
      barWidth = "100%";
    }
  }

  // Trigger callback when validation state changes
  const isValid = score === 5;
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  if (!hasInput) {
    return null;
  }

  const missingText = missingCriteria.map((c) => c.label).join(", ");

  return (
    <div style={{ marginTop: "8px", marginBottom: "8px", fontSize: "13px" }}>
      {/* Strength Indicator Text */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ color: "var(--text-secondary, #9ca3af)", fontSize: "12px" }}>Độ mạnh mật khẩu:</span>
        <span style={{ fontWeight: "600", color: strengthColor, transition: "color 0.3s ease" }}>
          {strengthLabel}
        </span>
      </div>

      {/* Progress Bar Track */}
      <div
        style={{
          height: "6px",
          width: "100%",
          backgroundColor: "var(--border, #e5e7eb)",
          borderRadius: "3px",
          overflow: "hidden",
          marginBottom: "6px",
        }}
      >
        {/* Progress Bar Fill */}
        <div
          style={{
            height: "100%",
            width: barWidth,
            backgroundColor: strengthColor,
            borderRadius: "3px",
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s ease",
          }}
        />
      </div>

      {/* Missing Conditions Row */}
      {missingText ? (
        <div style={{ color: "#b91c1c", fontSize: "12px", fontStyle: "italic", marginTop: "4px" }}>
          Còn thiếu: {missingText}
        </div>
      ) : (
        <div style={{ color: "#16a34a", fontSize: "12px", fontWeight: "500", marginTop: "4px" }}>
          Mật khẩu hợp lệ và mạnh!
        </div>
      )}
    </div>
  );
}
