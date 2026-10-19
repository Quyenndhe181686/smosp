import api from './api';

export const getMajors = async () => {
    const response = await api.get('/majors');
    return response.data;
};

export const getSpecializationsByMajor = async (majorId) => {
    const response = await api.get(`/majors/${majorId}/specializations`);
    return response.data;
};

export const getNarrowSpecsBySpecialization = async (specId) => {
    const response = await api.get(`/specializations/${specId}/narrow-specs`);
    return response.data;
};

export const getSpecializationSkills = async (specId) => {
    const response = await api.get(`/specializations/${specId}/skills`);
    return response.data;
};

export const getNarrowSpecDetail = async (nsId) => {
    const response = await api.get(`/narrow-specs/${nsId}`);
    return response.data;
};

export const createMajor = async (payload) => {
    const response = await api.post('/majors', payload);
    return response.data;
};

export const updateMajor = async (id, payload) => {
    const response = await api.put(`/majors/${id}`, payload);
    return response.data;
};

export const updateMajorStatus = async (id, isActive) => {
    const response = await api.patch(`/majors/${id}/status`, { isActive });
    return response.data;
};

export const createSpecialization = async (payload) => {
    const response = await api.post('/specializations', payload);
    return response.data;
};

export const updateSpecialization = async (id, payload) => {
    const response = await api.put(`/specializations/${id}`, payload);
    return response.data;
};

export const updateSpecializationStatus = async (id, isActive) => {
    const response = await api.patch(`/specializations/${id}/status`, { isActive });
    return response.data;
};

export const createNarrowSpec = async (payload) => {
    const response = await api.post('/narrow-specs', payload);
    return response.data;
};

export const updateNarrowSpec = async (id, payload) => {
    const response = await api.put(`/narrow-specs/${id}`, payload);
    return response.data;
};

export const publishNarrowSpec = async (id, isPublished) => {
    const response = await api.patch(`/narrow-specs/${id}/publish`, { isPublished });
    return response.data;
};

export const getSpecializationCourses = async (specId) => {
    const response = await api.get(`/specializations/${specId}/courses`);
    return response.data;
};

export const updateSpecializationCourses = async (specId, payload) => {
    const response = await api.put(`/specializations/${specId}/courses`, payload);
    return response.data;
};

export const getNarrowSpecCourses = async (nsId) => {
    const response = await api.get(`/narrow-specs/${nsId}/courses`);
    return response.data;
};

export const updateNarrowSpecCourses = async (nsId, payload) => {
    const response = await api.put(`/narrow-specs/${nsId}/courses`, payload);
    return response.data;
};

export const getNarrowSpecExcludedCourses = async (nsId) => {
    const response = await api.get(`/narrow-specs/${nsId}/excluded-courses`);
    return response.data;
};

export const updateNarrowSpecExcludedCourses = async (nsId, payload) => {
    const response = await api.put(`/narrow-specs/${nsId}/excluded-courses`, payload);
    return response.data;
};

export const uploadMajorImage = async (code, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/majors/${code}/image`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const uploadSpecializationImage = async (code, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/specializations/${code}/image`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const getWeightConfig = async (narrowSpecId) => {
    const response = await api.get(`/cm/narrow-specs/${narrowSpecId}/weight-config`);
    return response.data;
};

export const updateWeightConfig = async (narrowSpecId, payload) => {
    const response = await api.put(`/cm/narrow-specs/${narrowSpecId}/weight-config`, payload);
    return response.data;
};

export const getWeightConfigAudit = async (narrowSpecId, page = 0, size = 10) => {
    const response = await api.get(`/cm/narrow-specs/${narrowSpecId}/weight-config/audit`, {
        params: { page, size }
    });
    return response.data;
};

export const getStandardRoadmap = async (nsId) => {
    const response = await api.get(`/narrow-specs/${nsId}/roadmap`);
    return response.data;
};

export const searchCatalog = async (keyword) => {
    const response = await api.post('/catalog/search', { keyword });
    return response.data;
};



