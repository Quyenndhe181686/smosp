import api from './api';

// Get list of student's personal roadmaps
export const getMyRoadmaps = async () => {
    const response = await api.get('/students/me/roadmaps');
    return response.data;
};

// Clone standard roadmap into a new personal roadmap
export const cloneRoadmap = async (narrowSpecId) => {
    const response = await api.post('/students/me/roadmaps', { narrowSpecId });
    return response.data;
};

// Get detail of a specific personal roadmap (including terms and course progress/notes/bookmarks)
export const getRoadmapDetail = async (roadmapId) => {
    const response = await api.get(`/students/me/roadmaps/${roadmapId}`);
    return response.data;
};

// Rename a personal roadmap
export const renameRoadmap = async (roadmapId, name) => {
    const response = await api.put(`/students/me/roadmaps/${roadmapId}`, { name });
    return response.data;
};

// Delete a personal roadmap
export const deleteRoadmap = async (roadmapId) => {
    await api.delete(`/students/me/roadmaps/${roadmapId}`);
};

// Sync personal roadmap with student transcript grades
export const syncTranscript = async (roadmapId) => {
    await api.post(`/students/me/roadmaps/${roadmapId}/sync-transcript`);
};

// Update progress status of a course in a personal roadmap (status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED')
export const updateProgress = async (roadmapId, courseId, status) => {
    await api.patch(`/students/me/roadmaps/${roadmapId}/items/${courseId}/progress`, { status });
};

// Update custom grade of a course in a personal roadmap
export const updateGrade = async (roadmapId, courseId, grade) => {
    await api.put(`/students/me/roadmaps/${roadmapId}/items/${courseId}/grade`, { grade });
};

// Add bookmark to a course in a personal roadmap
export const addBookmark = async (roadmapId, courseId) => {
    await api.post(`/students/me/roadmaps/${roadmapId}/bookmarks/${courseId}`);
};

// Remove bookmark from a course in a personal roadmap
export const removeBookmark = async (roadmapId, courseId) => {
    await api.delete(`/students/me/roadmaps/${roadmapId}/bookmarks/${courseId}`);
};

// Update note for a course in a personal roadmap
export const updateNote = async (roadmapId, courseId, note) => {
    await api.put(`/students/me/roadmaps/${roadmapId}/notes/${courseId}`, { note });
};

// Remove note from a course in a personal roadmap
export const removeNote = async (roadmapId, courseId) => {
    await api.delete(`/students/me/roadmaps/${roadmapId}/notes/${courseId}`);
};

// Change term of a course in a personal roadmap (Rule 1: Advanced registration / Rule 2: Shift term)
// payload: { courseId: uuid, targetTerm: number, acknowledgedRisk?: boolean }
export const reorderRoadmapItems = async (roadmapId, payload) => {
    await api.patch(`/students/me/roadmaps/${roadmapId}/items/reorder`, payload);
};

export const batchReorderRoadmapItems = async (roadmapId, payload) => {
    await api.patch(`/students/me/roadmaps/${roadmapId}/items/batch-reorder`, payload);
};

// Upload a personal resource file (max 3 files per course, max 25MB each)
export const uploadPersonalResourceFile = async (roadmapId, courseId, title, resourceType, file) => {
    const formData = new FormData();
    if (title) formData.append('title', title);
    if (resourceType) formData.append('resourceType', resourceType);
    formData.append('file', file);

    const response = await api.post(`/students/me/roadmaps/${roadmapId}/items/${courseId}/resources/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

// Add a personal resource link
export const addPersonalResourceLink = async (roadmapId, courseId, payload) => {
    const response = await api.post(`/students/me/roadmaps/${roadmapId}/items/${courseId}/resources/link`, payload);
    return response.data;
};

// Delete a personal resource (file or link)
export const deletePersonalResource = async (roadmapId, resourceId) => {
    await api.delete(`/students/me/roadmaps/${roadmapId}/resources/${resourceId}`);
};