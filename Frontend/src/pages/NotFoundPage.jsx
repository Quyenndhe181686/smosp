import { useNavigate, useLocation } from 'react-router-dom'
import { Compass, ArrowLeft, Home } from 'lucide-react'
import './NotFoundPage.css'

/* Đích "về trang chính" khác nhau theo vai trò — đẩy Content Manager về trang
   chủ khách là bắt họ bấm thêm vài lần mới quay lại chỗ đang làm dở. */
const HOME_BY_ROLE = {
    ROLE_ADMIN: '/admin/dashboard',
    ROLE_SUPER_ADMIN: '/admin/dashboard',
    ROLE_CONTENT_MANAGER: '/cm/dashboard',
}

/**
 * Trang cho mọi đường dẫn không khớp route nào.
 *
 * Trước đây ứng dụng không có route bắt tất cả: gõ sai URL hoặc bấm phải một
 * liên kết hỏng trong code đều ra màn hình TRẮNG, không thông báo, không lối
 * quay lại. Lỗi kiểu đó trông hệt như hệ thống sập nên rất khó lần ra — đúng
 * cách một liên kết sai trên dashboard Content Manager đã lọt qua nhiều đợt
 * kiểm thử.
 */
export default function NotFoundPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const role = localStorage.getItem('role')
    const homePath = HOME_BY_ROLE[role] || '/'

    return (
        <div className="nf-page">
            <div className="nf-card">
                <span className="nf-icon"><Compass size={40} strokeWidth={1.6} /></span>
                <div className="nf-code">404</div>
                <h1 className="nf-title">Không tìm thấy trang này</h1>
                <p className="nf-text">
                    Đường dẫn <code className="nf-path">{location.pathname}</code> không tồn tại trên hệ thống SMOSP.
                    Có thể liên kết đã cũ hoặc bạn gõ nhầm địa chỉ.
                </p>
                <div className="nf-actions">
                    <button type="button" className="btn btn-md btn-ghost" onClick={() => navigate(-1)}>
                        <ArrowLeft size={15} /> Quay lại
                    </button>
                    <button type="button" className="btn btn-md btn-primary" onClick={() => navigate(homePath)}>
                        <Home size={15} /> Về trang chính
                    </button>
                </div>
            </div>
        </div>
    )
}
