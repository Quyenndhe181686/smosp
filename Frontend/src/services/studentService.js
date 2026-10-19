import api from './api';

// Student Profile API calls
export const getStudentProfile = async () => {
    const response = await api.get('/students/me');
    return response.data;
};

export const updateStudentProfile = async (payload) => {
    const response = await api.put('/students/me', payload);
    return response.data;
};

// Transcript API calls
export const uploadTranscript = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/students/me/transcripts', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const getLatestTranscript = async () => {
    const response = await api.get('/students/me/transcripts/latest');
    return response.data;
};

export const deleteTranscript = async () => {
    try {
        const response = await api.delete('/students/me/transcripts');
        return response.data;
    } catch (err) {
        console.warn("Delete transcript endpoint call:", err);
    }
};

export const getMyGrades = async () => {
    const response = await api.get('/students/me/grades');
    return response.data;
};

// Student Skill Declarations
export const getStudentSkillOptions = async () => {
    const response = await api.get('/students/me/skill-options');
    return response.data;
};

export const searchStudentSkillOptions = async (keyword) => {
    const response = await api.get('/students/me/skill-options/search', { params: { keyword } });
    return response.data;
};

export const getStudentSkillSuggestions = async () => {
    const response = await api.get('/students/me/skill-suggestions');
    return response.data;
};

export const getDeclaredSkills = async () => {
    const response = await api.get('/students/me/skills');
    return response.data;
};

export const updateDeclaredSkills = async (skillIds) => {
    const response = await api.put('/students/me/skills', skillIds);
    return response.data;
};

// Student Interest Declarations
export const getStudentInterestOptions = async () => {
    const response = await api.get('/students/me/interest-options');
    return response.data;
};

export const getDeclaredInterests = async () => {
    const response = await api.get('/students/me/interests');
    return response.data;
};

export const updateDeclaredInterests = async (interestOptionIds) => {
    const response = await api.put('/students/me/interests', interestOptionIds);
    return response.data;
};
