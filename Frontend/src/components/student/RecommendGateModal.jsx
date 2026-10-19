import { useNavigate } from "react-router-dom";
import { AlertTriangle, Target, Heart, UserCog, FileText, X } from "lucide-react";
import "./RecommendGateModal.css";

const ACT_SKILLS = { label: "Khai báo kỹ năng", to: "/student/profile/skills", icon: Target };
const ACT_INTERESTS = { label: "Khai báo sở thích", to: "/student/profile/interests", icon: Heart };
const ACT_TRANSCRIPT = { label: "Cập nhật bảng điểm", to: "/student/profile/transcript", icon: FileText };
const ACT_PROFILE = { label: "Cập nhật hồ sơ cá nhân", to: "/student/profile", icon: UserCog };

/**
 * Diễn giải message 409 từ POST /students/me/recommendation/run thành
 * tiêu đề + mô tả + các nút điều hướng tới đúng trang khai báo còn thiếu.
 */
function resolveGate(rawMessage) {
    const msg = rawMessage || "";

    if (/bảng điểm|kỹ năng|sở thích|ít nhất một|chưa khai báo gì/i.test(msg)) {
        return {
            title: "Bạn chưa cập nhật thông tin hồ sơ nào",
            description:
                "Hệ thống cần ít nhất một thông tin về kết quả học tập (bảng điểm), kỹ năng hoặc sở thích để phân tích gợi ý. Hãy khai báo thông tin rồi quay lại nhận gợi ý.",
            actions: [ACT_TRANSCRIPT, ACT_SKILLS, ACT_INTERESTS],
        };
    }

    if (/chuyên ngành hẹp nào được công bố/i.test(msg)) {
        return {
            title: "Chuyên ngành của bạn chưa có dữ liệu gợi ý",
            description:
                "Chuyên ngành bạn đang theo hiện chưa có chuyên ngành hẹp nào được công bố, nên hệ thống chưa thể phân tích. Vui lòng quay lại sau hoặc liên hệ cố vấn học tập.",
            actions: [],
        };
    }

    if (/chuyên ngành/i.test(msg)) {
        return {
            title: "Bạn chưa khai báo chuyên ngành",
            description:
                "Hãy cập nhật chuyên ngành trong hồ sơ cá nhân trước, vì hệ thống chỉ gợi ý các chuyên ngành hẹp thuộc chuyên ngành bạn đang theo.",
            actions: [ACT_PROFILE],
        };
    }

    return {
        title: "Chưa thể chạy gợi ý",
        description: msg || "Có lỗi xảy ra khi chạy thuật toán gợi ý. Vui lòng thử lại sau.",
        actions: [],
    };
}

export default function RecommendGateModal({ message, onClose }) {
    const navigate = useNavigate();

    if (!message) return null;

    const gate = resolveGate(message);

    return (
        <div className="rgate-overlay" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="rgate" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="rgate__close" onClick={onClose} aria-label="Đóng">
                    <X size={16} />
                </button>

                <span className="rgate__icon">
                    <AlertTriangle size={22} />
                </span>

                <h3 className="rgate__title">{gate.title}</h3>
                <p className="rgate__desc">{gate.description}</p>

                <div className="rgate__actions">
                    {gate.actions.map((a) => (
                        <button
                            key={a.to}
                            type="button"
                            className="rgate__btn rgate__btn--primary"
                            onClick={() => navigate(a.to)}
                        >
                            <a.icon size={14} />
                            {a.label}
                        </button>
                    ))}
                    <button type="button" className="rgate__btn rgate__btn--ghost" onClick={onClose}>
                        Để sau
                    </button>
                </div>
            </div>
        </div>
    );
}
