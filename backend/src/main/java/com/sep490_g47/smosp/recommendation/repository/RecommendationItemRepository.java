package com.sep490_g47.smosp.recommendation.repository;

import com.sep490_g47.smosp.recommendation.entity.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, UUID> {
    
    List<RecommendationItem> findByResultIdOrderByRankAsc(UUID resultId);
    
    Optional<RecommendationItem> findByResultIdAndNarrowSpecId(UUID resultId, UUID narrowSpecId);

    List<RecommendationItem> findByResultIdAndNarrowSpecIdIn(UUID resultId, List<UUID> narrowSpecIds);

    @Modifying
    @Query("DELETE FROM RecommendationItem i WHERE i.result.id IN :resultIds")
    void deleteByResultIdIn(@Param("resultIds") List<UUID> resultIds);
}
