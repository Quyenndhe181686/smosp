import api from './api';

// ── Crawler Batches ──
export const runCrawl = async (specializationId) => {
    const response = await api.post('/cm/crawler/run', { specializationId });
    return response.data;
};

export const runCrawlAll = async () => {
    const response = await api.post('/cm/crawler/run-all');
    return response.data;
};

/**
 * Xin dừng một phiên crawl đang chạy.
 *
 * Máy chủ chỉ ghi nhận yêu cầu rồi trả 202 — luồng crawl thoát ở trang kế tiếp
 * (vài giây sau), nên gọi xong vẫn phải poll để thấy status chuyển CANCELLED.
 *
 * Chỉ người đã bấm chạy phiên đó hoặc Admin mới dừng được; người khác nhận 403.
 */
export const cancelCrawlBatch = async (batchId, reason) => {
    const response = await api.post(`/cm/crawler/batches/${batchId}/cancel`, { reason });
    return response.data;
};

/** Dừng mọi phiên người gọi được phép dừng — Admin: tất cả, CM: chỉ của mình. */
export const cancelAllCrawlBatches = async (reason) => {
    const response = await api.post('/cm/crawler/cancel-all', { reason });
    return response.data;
};

export const getCrawlBatches = async () => {
    const response = await api.get('/cm/crawler/batches');
    return response.data;
};

// Chỉ các batch đang RUNNING — dùng để dò phiên đang chạy lúc mở trang mà không
// phải tải toàn bộ lịch sử batch rồi filter ở client.
export const getActiveCrawlBatches = async () => {
    const response = await api.get('/cm/crawler/batches/active');
    return response.data;
};

export const getCrawlBatchDetails = async (id) => {
    const response = await api.get(`/cm/crawler/batches/${id}`);
    return response.data;
};

export const getCrawlBatchErrors = async (id) => {
    const response = await api.get(`/cm/crawler/batches/${id}/errors`);
    return response.data;
};

export const normalizeBatch = async (id) => {
    const response = await api.post(`/cm/crawler/batches/${id}/normalize`);
    return response.data;
};

export const normalizeAll = async () => {
    const response = await api.post('/cm/crawler/normalize-all');
    return response.data;
};

export const getNormalizeStatus = async (id) => {
    const response = await api.get(`/cm/crawler/batches/${id}/normalize-status`);
    return response.data;
};

// ── Polling Helpers ──
const CRAWL_TERMINAL_STATUSES = ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'];
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes

/**
 * Poll GET /batches/{id} until status is terminal.
 * @param {string} batchId
 * @param {(batch: object) => void} onUpdate
 * @param {{ intervalMs?: number, timeoutMs?: number }} options
 * @returns {() => void} cleanup function
 */
export function pollCrawlBatch(batchId, onUpdate, options = {}) {
    const intervalMs = options.intervalMs || DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs || DEFAULT_POLL_TIMEOUT_MS;
    let timeoutId = null;
    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
        if (cancelled) return;
        try {
            const batch = await getCrawlBatchDetails(batchId);
            if (!cancelled && onUpdate) {
                onUpdate(batch);
            }
            if (batch && CRAWL_TERMINAL_STATUSES.includes(batch.status)) {
                return;
            }
        } catch (err) {
            console.error('Poll crawl batch failed:', err);
        }

        if (Date.now() - startedAt > timeoutMs) {
            if (!cancelled && onUpdate) {
                onUpdate({ id: batchId, status: 'TIMEOUT' });
            }
            return;
        }

        if (!cancelled) {
            timeoutId = setTimeout(tick, intervalMs);
        }
    };

    tick();

    return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
    };
}

/**
 * Poll GET /batches/{id}/normalize-status until pending === 0.
 * @param {string} batchId
 * @param {(status: object) => void} onUpdate
 * @param {{ intervalMs?: number, timeoutMs?: number }} options
 * @returns {() => void} cleanup function
 */
export function pollNormalizeStatus(batchId, onUpdate, options = {}) {
    const intervalMs = options.intervalMs || DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs || DEFAULT_POLL_TIMEOUT_MS;
    let timeoutId = null;
    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
        if (cancelled) return;
        try {
            const normStatus = await getNormalizeStatus(batchId);
            if (!cancelled && onUpdate) {
                onUpdate(normStatus);
            }
            if (normStatus && normStatus.pending === 0) {
                return;
            }
        } catch (err) {
            console.error('Poll normalize status failed:', err);
        }

        if (Date.now() - startedAt > timeoutMs) {
            if (!cancelled && onUpdate) {
                onUpdate({ batchId, pending: 0, status: 'TIMEOUT' });
            }
            return;
        }

        if (!cancelled) {
            timeoutId = setTimeout(tick, intervalMs);
        }
    };

    tick();

    return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
    };
}

/**
 * Poll GET /batches/{id} until the backend-computed `stage` reaches a terminal
 * value (DONE / FAILED). Dùng cho bước tính Trending Weight: bước này chạy nền ở
 * backend, `status` của batch đã là SUCCESS từ lúc cào xong nên không phản ánh
 * được nữa — chỉ còn `stage` cho biết đã tính xong hay chưa.
 * @param {string} batchId
 * @param {(batch: object) => void} onUpdate
 * @param {{ intervalMs?: number, timeoutMs?: number }} options
 * @returns {() => void} cleanup function
 */
export function pollBatchStage(batchId, onUpdate, options = {}) {
    const intervalMs = options.intervalMs || DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options.timeoutMs || DEFAULT_POLL_TIMEOUT_MS;
    let timeoutId = null;
    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
        if (cancelled) return;
        try {
            const batch = await getCrawlBatchDetails(batchId);
            if (!cancelled && onUpdate) {
                onUpdate(batch);
            }
            if (batch && (batch.stage === 'DONE' || batch.stage === 'FAILED')) {
                return;
            }
        } catch (err) {
            console.error('Poll batch stage failed:', err);
        }

        if (Date.now() - startedAt > timeoutMs) {
            if (!cancelled && onUpdate) {
                onUpdate({ id: batchId, stage: 'TIMEOUT' });
            }
            return;
        }

        if (!cancelled) {
            timeoutId = setTimeout(tick, intervalMs);
        }
    };

    tick();

    return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
    };
}

/**
 * Promise wrapper to wait for a crawl batch to finish.
 */
export function waitForCrawlBatch(batchId, options = {}) {
    const { onUpdate } = options;
    return new Promise((resolve, reject) => {
        pollCrawlBatch(batchId, (batch) => {
            if (onUpdate) onUpdate(batch);
            if (batch && CRAWL_TERMINAL_STATUSES.includes(batch.status)) {
                resolve(batch);
            } else if (batch && batch.status === 'TIMEOUT') {
                reject(new Error('Crawl batch polling timed out'));
            }
        }, options);
    });
}

/**
 * Promise wrapper to wait for normalize status pending === 0.
 */
export function waitForNormalizeStatus(batchId, options = {}) {
    const { onUpdate } = options;
    return new Promise((resolve, reject) => {
        pollNormalizeStatus(batchId, (statusData) => {
            if (onUpdate) onUpdate(statusData);
            if (statusData && statusData.pending === 0 && statusData.status !== 'TIMEOUT') {
                resolve(statusData);
            } else if (statusData && statusData.status === 'TIMEOUT') {
                reject(new Error('Normalize polling timed out'));
            }
        }, options);
    });
}


// ── Trending Weight ──
export const calculateTrendingWeights = async () => {
    const response = await api.post('/cm/crawler/trending-weight/calculate');
    return response.data;
};

export const getTrendingWeightProposals = async (status = 'PENDING') => {
    const response = await api.get('/cm/crawler/trending-weight/proposals', { params: { status } });
    return response.data;
};

export const approveTrendingWeightProposal = async (id) => {
    const response = await api.post(`/cm/crawler/trending-weight/proposals/${id}/approve`);
    return response.data;
};

export const rejectTrendingWeightProposal = async (id) => {
    const response = await api.post(`/cm/crawler/trending-weight/proposals/${id}/reject`);
    return response.data;
};

/**
 * Duyệt / từ chối nhiều đề xuất trong MỘT request.
 *
 * Thay cho vòng lặp `await` gọi từng endpoint /approve — một đợt hơn trăm CNH là
 * hơn trăm request tuần tự, và nếu người dùng đóng tab giữa chừng thì một nửa đã
 * duyệt, một nửa còn chờ.
 *
 * Máy chủ xử lý mỗi đề xuất trong transaction riêng nên luôn trả 200 kèm bảng kết
 * quả từng dòng: { total, succeeded, failed, results: [{ proposalId,
 * narrowSpecCode, success, errorMessage }] }. Gọi xong PHẢI đọc `failed`, đừng coi
 * 200 là mọi thứ đều xong.
 */
export const bulkApproveTrendingWeightProposals = async (proposalIds) => {
    const response = await api.post('/cm/crawler/trending-weight/proposals/bulk-approve', { proposalIds });
    return response.data;
};

export const bulkRejectTrendingWeightProposals = async (proposalIds) => {
    const response = await api.post('/cm/crawler/trending-weight/proposals/bulk-reject', { proposalIds });
    return response.data;
};

export const getCurrentTrendingWeights = async () => {
    const response = await api.get('/cm/crawler/trending-weight/current');
    return response.data;
};

export const getTrendingWeightHistory = async (narrowSpecId) => {
    const response = await api.get('/cm/crawler/trending-weight/history', { params: { narrowSpecId } });
    return response.data;
};

export const rollbackTrendingWeight = async (requestPayload) => {
    const response = await api.post('/cm/crawler/trending-weight/rollback', requestPayload);
    return response.data;
};

export const rollbackTrendingWeightBatch = async (requestPayloads) => {
    const response = await api.post('/cm/crawler/trending-weight/rollback-batch', requestPayloads);
    return response.data;
};

// ── Crawler Keywords ──
export const getCrawlerKeywords = async (narrowSpecId) => {
    const response = await api.get('/cm/crawler-keywords', { params: { narrowSpecId } });
    return response.data;
};

export const createCrawlerKeyword = async (payload) => {
    const response = await api.post('/cm/crawler-keywords', payload);
    return response.data;
};

export const updateCrawlerKeyword = async (id, payload) => {
    const response = await api.patch(`/cm/crawler-keywords/${id}`, payload);
    return response.data;
};

export const deleteCrawlerKeyword = async (id) => {
    await api.delete(`/cm/crawler-keywords/${id}`);
};

// ── Admin Crawler Sources ──
export const getCrawlerSources = async () => {
    const response = await api.get('/admin/crawler/sources');
    return response.data;
};

export const updateCrawlerSource = async (id, payload) => {
    const response = await api.put(`/admin/crawler/sources/${id}`, payload);
    return response.data;
};

export const toggleCrawlerSource = async (id) => {
    const response = await api.patch(`/admin/crawler/sources/${id}/toggle`);
    return response.data;
};
