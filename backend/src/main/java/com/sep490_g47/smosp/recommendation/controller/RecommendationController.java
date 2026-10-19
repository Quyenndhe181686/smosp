package com.sep490_g47.smosp.recommendation.controller;

import com.sep490_g47.smosp.recommendation.dto.response.RecommendationDetailResponse;
import com.sep490_g47.smosp.recommendation.dto.response.RecommendationHistoryResponse;
import com.sep490_g47.smosp.recommendation.dto.response.RecommendationResultResponse;
import com.sep490_g47.smosp.recommendation.dto.response.ConsultationResponse;
import com.sep490_g47.smosp.recommendation.service.ConsultationService;
import com.sep490_g47.smosp.recommendation.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/students/me/recommendation")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STUDENT')")
public class RecommendationController {

    private final RecommendationService recommendationService;
    private final ConsultationService consultationService;

    @PostMapping("/run")
    public ResponseEntity<RecommendationResultResponse> runRecommendation() {
        return ResponseEntity.ok(recommendationService.runRecommendation());
    }

    @GetMapping("/latest")
    public ResponseEntity<RecommendationResultResponse> getLatestRecommendation() {
        return ResponseEntity.ok(recommendationService.getLatestRecommendation());
    }

    @GetMapping("/latest/items/{nsId}")
    public ResponseEntity<RecommendationDetailResponse> getRecommendationItemDetail(@PathVariable UUID nsId) {
        return ResponseEntity.ok(recommendationService.getRecommendationItemDetail(nsId));
    }

    @GetMapping("/latest/compare")
    public ResponseEntity<List<RecommendationDetailResponse>> compareRecommendations(@RequestParam List<UUID> nsIds) {
        return ResponseEntity.ok(recommendationService.compareRecommendations(nsIds));
    }

    @GetMapping("/history")
    public ResponseEntity<List<RecommendationHistoryResponse>> getRecommendationHistory() {
        return ResponseEntity.ok(recommendationService.getRecommendationHistory());
    }

    @GetMapping("/results/{resultId}")
    public ResponseEntity<RecommendationResultResponse> getRecommendationResultById(@PathVariable UUID resultId) {
        return ResponseEntity.ok(recommendationService.getRecommendationResultById(resultId));
    }

    @GetMapping("/results/{resultId}/items/{nsId}")
    public ResponseEntity<RecommendationDetailResponse> getRecommendationItemDetailByResult(
            @PathVariable UUID resultId,
            @PathVariable UUID nsId) {
        return ResponseEntity.ok(recommendationService.getRecommendationItemDetailByResult(resultId, nsId));
    }

    @GetMapping("/latest/items/{nsId}/consultation")
    public ResponseEntity<ConsultationResponse> getLatestConsultation(@PathVariable UUID nsId) {
        return ResponseEntity.ok(consultationService.getConsultationForLatest(nsId));
    }

    @GetMapping("/results/{resultId}/items/{nsId}/consultation")
    public ResponseEntity<ConsultationResponse> getConsultationByResult(
            @PathVariable UUID resultId,
            @PathVariable UUID nsId) {
        return ResponseEntity.ok(consultationService.getConsultationByResult(resultId, nsId));
    }
}
