import api from './api';

export const getTranscriptPresets = async () => {
    const response = await api.get('/admin/transcript-presets');
    return response.data;
};

export const createTranscriptPreset = async (payload) => {
    const response = await api.post('/admin/transcript-presets', payload);
    return response.data;
};

export const updateTranscriptPreset = async (id, payload) => {
    const response = await api.put(`/admin/transcript-presets/${id}`, payload);
    return response.data;
};

export const deleteTranscriptPreset = async (id) => {
    const response = await api.delete(`/admin/transcript-presets/${id}`);
    return response.data;
};

export const activateTranscriptPreset = async (id) => {
    const response = await api.patch(`/admin/transcript-presets/${id}/activate`);
    return response.data;
};
