import api from './api';

// Submit a new content error report
export const submitErrorReport = async (payload) => {
    // payload: { entityType, entityId, description }
    const response = await api.post('/content-error-reports', payload);
    return response.data;
};

// Get all error reports submitted by the logged-in student
export const getMyErrorReports = async () => {
    const response = await api.get('/content-error-reports');
    return response.data;
};

// Get a specific error report by its UUID
export const getErrorReportById = async (id) => {
    const response = await api.get(`/content-error-reports/${id}`);
    return response.data;
};

// Update description of an existing error report (only if status is 'NEW')
export const updateErrorReport = async (id, payload) => {
    // payload: { description }
    const response = await api.put(`/content-error-reports/${id}`, payload);
    return response.data;
};

// Cancel an error report (only if status is 'NEW')
export const cancelErrorReport = async (id) => {
    const response = await api.patch(`/content-error-reports/${id}/cancel`);
    return response.data;
};

// ── Content Manager (CM) Endpoints ──

// Get all reports for Content Manager
export const getCmErrorReports = async (status = '') => {
    const params = status ? { status } : {};
    const response = await api.get('/cm/content-error-reports', { params });
    return response.data;
};

// Get a single report details for Content Manager
export const getCmErrorReportById = async (id) => {
    const response = await api.get(`/cm/content-error-reports/${id}`);
    return response.data;
};

// Process an error report (update status and add processingNote)
export const processErrorReport = async (id, payload) => {
    // payload: { status, processingNote }
    const response = await api.patch(`/cm/content-error-reports/${id}/process`, payload);
    return response.data;
};

// ── Admin Endpoints ──

// Get all reports for Admin
export const getAdminErrorReports = async (status = '') => {
    const params = status ? { status } : {};
    const response = await api.get('/admin/content-error-reports', { params });
    return response.data;
};

// Soft-delete report with a reason for Admin
export const deleteAdminErrorReport = async (id, deletedReason) => {
    const response = await api.delete(`/admin/content-error-reports/${id}`, {
        data: { deletedReason }
    });
    return response.data;
};
