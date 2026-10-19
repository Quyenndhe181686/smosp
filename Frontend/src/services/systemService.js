import api from './api';

export const getSystemConfigs = async () => {
    const response = await api.get('/admin/system-config');
    return response.data;
};

export const updateSystemConfigs = async (configs) => {
    const response = await api.put('/admin/system-config', { configs });
    return response.data;
};

export const getAiUsageStats = async () => {
    const response = await api.get('/admin/ai-usage');
    return response.data;
};

/**
 * AC-56-03 — gọi thử tới endpoint/model AI đang cấu hình.
 *
 * POST vì mỗi lần gọi phát sinh một request thật tới nhà cung cấp AI (tốn một
 * lượng token nhỏ), không được để cache hay prefetch.
 */
export const testAiConnection = async () => {
    const response = await api.post('/admin/ai-config/test-connection');
    return response.data;
};

export const getSystemStats = async () => {
    const response = await api.get('/admin/system-status');
    return response.data;
};
