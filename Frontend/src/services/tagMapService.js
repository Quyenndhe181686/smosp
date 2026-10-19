import api from './api';

export const getTagMap = async (narrowSpecId) => {
    const response = await api.get(`/narrow-specs/${narrowSpecId}/tag-map`);
    return response.data;
};

export const updateTagMap = async (narrowSpecId, entries) => {
    const response = await api.put(`/narrow-specs/${narrowSpecId}/tag-map`, entries);
    return response.data;
};

/* Kỹ năng suy ra từ môn học của chuyên ngành hẹp (kể cả qua môn tiên quyết)
   mà ánh xạ hiện tại còn thiếu. */
export const getTagMapSuggestions = async (narrowSpecId) => {
    const response = await api.get(`/narrow-specs/${narrowSpecId}/tag-map/suggestions`);
    return response.data;
};

/* Ghi các mục còn thiếu vào ánh xạ; mục CM đã cấu hình được giữ nguyên. */
export const syncTagMapFromCourses = async (narrowSpecId) => {
    const response = await api.post(`/narrow-specs/${narrowSpecId}/tag-map/sync`);
    return response.data;
};
