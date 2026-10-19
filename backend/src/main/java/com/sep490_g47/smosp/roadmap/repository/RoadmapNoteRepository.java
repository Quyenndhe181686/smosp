package com.sep490_g47.smosp.roadmap.repository;

import com.sep490_g47.smosp.roadmap.entity.RoadmapNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoadmapNoteRepository extends JpaRepository<RoadmapNote, UUID> {
    List<RoadmapNote> findByPersonalRoadmapId(UUID roadmapId);
    Optional<RoadmapNote> findByPersonalRoadmapIdAndCourseId(UUID roadmapId, UUID courseId);
    void deleteByPersonalRoadmapIdAndCourseId(UUID roadmapId, UUID courseId);
}
