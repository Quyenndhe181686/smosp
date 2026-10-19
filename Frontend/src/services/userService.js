import api from './api';

export const getUsers = async (params = {}) => {
    const cleanParams = {
        role: params.role,
        keyword: params.keyword ? params.keyword.trim() : "",
        page: params.page !== undefined ? params.page : 0,
        size: params.size !== undefined ? params.size : 10,
    };
    if (params.status && params.status !== 'ALL') {
        cleanParams.status = params.status;
    }
    const response = await api.get('/admin/users', { params: cleanParams });
    return response.data;
};

/**
 * Số liệu tổng hợp của một nhóm tài khoản (tổng / đang hoạt động / vô hiệu hóa /
 * mới trong tháng). Danh sách chỉ trả về đúng một trang nên không cộng dồn được
 * ở frontend.
 */
export const getUserStats = async (role) => {
    const response = await api.get('/admin/users/stats', { params: { role } });
    return response.data;
};

export const updateUserStatus = async (id, status) => {
    const response = await api.patch(`/admin/users/${id}/status`, { status });
    return response.data;
};

export const resetUserPassword = async (id, newPassword) => {
    const response = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
};

export const createStaffAccount = async (payload) => {
    const response = await api.post('/admin/staff', payload);
    return response.data;
};
