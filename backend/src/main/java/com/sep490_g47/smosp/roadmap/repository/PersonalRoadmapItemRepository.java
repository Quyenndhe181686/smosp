package com.sep490_g47.smosp.roadmap.repository;

import com.sep490_g47.smosp.roadmap.entity.PersonalRoadmapItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PersonalRoadmapItemRepository extends JpaRepository<PersonalRoadmapItem, UUID> {
    List<PersonalRoadmapItem> findByPersonalRoadmapId(UUID roadmapId);
    Optional<PersonalRoadmapItem> findByPersonalRoadmapIdAndCourseId(UUID roadmapId, UUID courseId);
    List<PersonalRoadmapItem> findByPersonalRoadmapIdOrderByPersonalTermNoAsc(UUID roadmapId);
}
