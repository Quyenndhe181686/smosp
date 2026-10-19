package com.sep490_g47.smosp.recommendation.service;

import com.sep490_g47.smosp.recommendation.dto.response.RecommendationDetailResponse;
import com.sep490_g47.smosp.recommendation.dto.response.RecommendationHistoryResponse;
import com.sep490_g47.smosp.recommendation.dto.response.RecommendationResultResponse;

import java.util.List;
import java.util.UUID;

public interface RecommendationService {
    RecommendationResultResponse runRecommendation();
    RecommendationResultResponse getLatestRecommendation();
    RecommendationDetailResponse getRecommendationItemDetail(UUID nsId);
    List<RecommendationDetailResponse> compareRecommendations(List<UUID> nsIds);
    List<RecommendationHistoryResponse> getRecommendationHistory();
    RecommendationResultResponse getRecommendationResultById(UUID resultId);
    RecommendationDetailResponse getRecommendationItemDetailByResult(UUID resultId, UUID nsId);
}
