import api from './api';

/**
 * Toàn bộ số liệu trang CM Dashboard trong một request.
 *
 * Thay cho cách cũ: duyệt cây danh mục ở frontend rồi gọi tag-map /
 * weight-config / trending-weight-history cho từng chuyên ngành hẹp — số request
 * tăng theo số CNH và thường làm treo tab. Backend giờ tính sẵn bằng vài truy
 * vấn set-based.
 */
export const getCmDashboardOverview = async () => {
    const response = await api.get('/cm/dashboard/overview');
    return response.data;
};
