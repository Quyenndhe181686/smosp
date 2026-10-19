import api from './api';

export const getSpecializationSkills = async (specId) => {
    const response = await api.get(`/cm/specializations/${specId}/skills`);
    return response.data;
};

export const createSkill = async (payload) => {
    const response = await api.post('/cm/skills', payload);
    return response.data;
};

export const updateSkill = async (id, payload) => {
    const response = await api.put(`/cm/skills/${id}`, payload);
    return response.data;
};

export const updateSkillStatus = async (id, isActive) => {
    const response = await api.patch(`/cm/skills/${id}/status`, { isActive });
    return response.data;
};

export const updateSkillAliases = async (id, aliases) => {
    const response = await api.put(`/cm/skills/${id}/aliases`, { aliases });
    return response.data;
};

export const updateSkillCourseMap = async (id, courseIds) => {
    const response = await api.put(`/cm/skills/${id}/course-map`, { courseIds });
    return response.data;
};
