import api from './api';

/**
 * Trigger recommendation calculation algorithm for current student
 * @returns {Promise<Object>} RecommendationResultResponse
 */
export async function runRecommendation() {
    const response = await api.post('/students/me/recommendation/run');
    return response.data;
}

/**
 * Fetch latest recommendation result for current student
 * @returns {Promise<Object>} RecommendationResultResponse
 */
export async function getLatestRecommendation() {
    const response = await api.get('/students/me/recommendation/latest');
    return response.data;
}

/**
 * Fetch recommendation detail for a specific narrow specialization
 * @param {string} nsId - Narrow Spec UUID
 * @returns {Promise<Object>} RecommendationDetailResponse
 */
export async function getRecommendationItemDetail(nsId) {
    const response = await api.get(`/students/me/recommendation/latest/items/${nsId}`);
    return response.data;
}

/**
 * Compare recommendation details across multiple narrow specializations
 * @param {Array<string>} nsIds - Array of Narrow Spec UUIDs
 * @returns {Promise<Array>} List<RecommendationDetailResponse>
 */
export async function compareRecommendations(nsIds) {
    const response = await api.get('/students/me/recommendation/latest/compare', {
        params: { nsIds: nsIds.join(',') }
    });
    return response.data;
}

/**
 * Fetch recommendation calculation history list for current student
 * @returns {Promise<Array>} List<RecommendationHistoryResponse>
 */
export async function getRecommendationHistory() {
    const response = await api.get('/students/me/recommendation/history');
    return response.data;
}

/**
 * Fetch recommendation result by result UUID
 * @param {string} resultId - RecommendationResult UUID
 * @returns {Promise<Object>} RecommendationResultResponse
 */
export async function getRecommendationResultById(resultId) {
    const response = await api.get(`/students/me/recommendation/results/${resultId}`);
    return response.data;
}

/**
 * Fetch recommendation item detail for a specific result UUID and narrow spec UUID
 * @param {string} resultId - RecommendationResult UUID
 * @param {string} nsId - Narrow Spec UUID
 * @returns {Promise<Object>} RecommendationDetailResponse
 */
export async function getRecommendationItemDetailByResult(resultId, nsId) {
    const response = await api.get(`/students/me/recommendation/results/${resultId}/items/${nsId}`);
    return response.data;
}

/**
 * Fetch consultation text for a specific narrow spec
 * @param {string} nsId - Narrow Spec UUID
 * @returns {Promise<Object>} ConsultationResponse
 */
export async function getConsultationItemDetail(nsId) {
    const response = await api.get(`/students/me/recommendation/latest/items/${nsId}/consultation`);
    return response.data;
}

/**
 * Fetch consultation text for a specific result UUID and narrow spec UUID
 * @param {string} resultId - RecommendationResult UUID
 * @param {string} nsId - Narrow Spec UUID
 * @returns {Promise<Object>} ConsultationResponse
 */
export async function getConsultationItemDetailByResult(resultId, nsId) {
    const response = await api.get(`/students/me/recommendation/results/${resultId}/items/${nsId}/consultation`);
    return response.data;
}
