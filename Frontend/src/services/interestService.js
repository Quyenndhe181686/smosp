import api from './api';

export const getSpecializationInterests = async (specId) => {
    const response = await api.get(`/cm/specializations/${specId}/interests`);
    return response.data;
};

export const createInterest = async (payload) => {
    const response = await api.post('/cm/interests', payload);
    return response.data;
};

export const updateInterest = async (id, payload) => {
    const response = await api.put(`/cm/interests/${id}`, payload);
    return response.data;
};

export const updateInterestStatus = async (id, isActive) => {
    const response = await api.patch(`/cm/interests/${id}/status`, { isActive });
    return response.data;
};
