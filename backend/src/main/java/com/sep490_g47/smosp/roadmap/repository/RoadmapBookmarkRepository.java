package com.sep490_g47.smosp.roadmap.repository;

import com.sep490_g47.smosp.roadmap.entity.RoadmapBookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoadmapBookmarkRepository extends JpaRepository<RoadmapBookmark, UUID> {
    List<RoadmapBookmark> findByPersonalRoadmapId(UUID roadmapId);
    Optional<RoadmapBookmark> findByPersonalRoadmapIdAndCourseId(UUID roadmapId, UUID courseId);
    void deleteByPersonalRoadmapIdAndCourseId(UUID roadmapId, UUID courseId);
}
