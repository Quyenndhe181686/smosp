package com.sep490_g47.smosp.recommendation.repository;

import com.sep490_g47.smosp.recommendation.entity.RecommendationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecommendationResultRepository extends JpaRepository<RecommendationResult, UUID> {
    
    Optional<RecommendationResult> findFirstByStudentIdOrderByCalculatedAtDesc(UUID studentId);

    List<RecommendationResult> findByStudentIdOrderByCalculatedAtDesc(UUID studentId);

    long countByStudentId(UUID studentId);
}
