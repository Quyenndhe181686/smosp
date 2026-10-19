import api from './api';

export const getCourses = async (params) => {
    const response = await api.get('/courses', { params });
    return response.data;
};

/**
 * Tìm môn học cho ô chọn của người dùng cuối.
 *
 * Phải dùng endpoint riêng: getCourses() ở trên gọi vào API quản trị của Content
 * Manager (@PreAuthorize hasAnyRole('CONTENT_MANAGER')) nên sinh viên gọi sẽ nhận
 * 403 và danh sách môn luôn rỗng.
 */
export const searchCourseOptions = async (keyword, limit = 50) => {
    const response = await api.get('/courses/search', { params: { q: keyword, limit } });
    return response.data;
};

export const getCourseDetail = async (id) => {
    const response = await api.get(`/courses/${id}`);
    return response.data;
};

export const createCourse = async (payload) => {
    const response = await api.post('/courses', payload);
    return response.data;
};

export const updateCourse = async (id, payload) => {
    const response = await api.put(`/courses/${id}`, payload);
    return response.data;
};

export const deleteCourse = async (id) => {
    await api.delete(`/courses/${id}`);
};

export const updatePrerequisites = async (id, prerequisiteIds) => {
    const response = await api.put(`/courses/${id}/prerequisites`, prerequisiteIds);
    return response.data;
};

export const uploadResource = async (courseId, title, resourceType, linkUrl, file = null) => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('resourceType', resourceType);
    if (file) {
        formData.append('file', file);
    }
    if (linkUrl) {
        formData.append('linkUrl', linkUrl);
    }
    const response = await api.post(`/courses/${courseId}/resources`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const deleteResource = async (id) => {
    await api.delete(`/resources/${id}`);
};

export const updateResource = async (id, title, resourceType, linkUrl, displayOrder = null, file = null) => {
    const formData = new FormData();
    if (title) formData.append('title', title);
    if (resourceType) formData.append('resourceType', resourceType);
    if (linkUrl) formData.append('linkUrl', linkUrl);
    if (displayOrder !== null && displayOrder !== undefined) formData.append('displayOrder', displayOrder);
    if (file) {
        formData.append('file', file);
    }
    const response = await api.put(`/resources/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const updateResourceOrder = async (courseId, orderMap) => {
    const response = await api.put(`/courses/${courseId}/resources/order`, orderMap);
    return response.data;
};
